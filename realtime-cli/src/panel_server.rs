use axum::extract::ws::{WebSocket, WebSocketUpgrade, Message as WsMessage};
use axum::extract::State;
use axum::extract::Path;
use axum::http::{header, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use rust_embed::Embed;
use std::collections::HashMap;
use std::net::TcpListener;
use std::sync::Arc;
use tokio::sync::broadcast;
use futures_util::{SinkExt, StreamExt};

#[derive(Embed)]
#[folder = "../panel-browser/dist/"]
struct PanelAssets;

#[derive(Clone)]
pub struct AppState {
    pub tx: broadcast::Sender<String>,
    pub last_msg: Arc<tokio::sync::Mutex<Option<String>>>,
    /// Raw file contents — updated by watcher or /push endpoint
    pub raw_files: Arc<tokio::sync::Mutex<HashMap<String, String>>>,
}

pub fn create_panel_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(serve_index))
        .route("/ws", get(ws_handler))
        .route("/push", post(push_handler))
        .route("/assets/{*path}", get(serve_asset))
        .with_state(state)
}

async fn serve_index(State(_state): State<AppState>) -> impl IntoResponse {
    match PanelAssets::get("index.html") {
        Some(content) => {
            let html = String::from_utf8_lossy(&content.data);
            Html(html.to_string()).into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// POST /push — receives raw file content and broadcasts to all connected browsers.
/// Body: JSON { "files": { "index.html": "<content>", "style.css": "<content>" } }
async fn push_handler(
    State(state): State<AppState>,
    body: String,
) -> impl IntoResponse {
    // Parse the incoming files
    let parsed: Result<PushPayload, _> = serde_json::from_str(&body);
    match parsed {
        Ok(payload) => {
            // Update raw files store
            {
                let mut files = state.raw_files.lock().await;
                for (path, content) in &payload.files {
                    files.insert(path.clone(), content.clone());
                }
            }

            // Broadcast raw files to all browsers
            let files = state.raw_files.lock().await;
            let msg = serde_json::json!({ "files": *files }).to_string();
            {
                let mut lm = state.last_msg.lock().await;
                *lm = Some(msg.clone());
            }
            let _ = state.tx.send(msg);

            StatusCode::OK.into_response()
        }
        Err(_) => StatusCode::BAD_REQUEST.into_response(),
    }
}

#[derive(serde::Deserialize)]
struct PushPayload {
    files: HashMap<String, String>,
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    let (mut sink, mut _stream) = socket.split();
    let mut rx = state.tx.subscribe();

    // Send last message immediately on connect
    {
        let last = state.last_msg.lock().await;
        if let Some(ref msg) = *last {
            let _ = sink.send(WsMessage::Text(msg.clone().into())).await;
        }
    }

    // Forward broadcast messages to this client
    while let Ok(msg) = rx.recv().await {
        if sink.send(WsMessage::Text(msg.into())).await.is_err() {
            break;
        }
    }
}

async fn serve_asset(Path(path): Path<String>) -> impl IntoResponse {
    let asset_path = format!("assets/{}", path);
    match PanelAssets::get(&asset_path) {
        Some(content) => {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            Response::builder()
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(axum::body::Body::from(content.data.to_vec()))
                .unwrap()
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

pub fn find_available_port(start_port: u16) -> Option<u16> {
    for offset in 0..100u16 {
        let port = start_port.checked_add(offset)?;
        if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

pub async fn start_panel_server(
    requested_port: u16,
    state: AppState,
) -> Result<(u16, tokio::task::JoinHandle<()>), Box<dyn std::error::Error>> {
    let port = find_available_port(requested_port)
        .ok_or("No available port found")?;

    let app = create_panel_router(state);
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await?;

    let handle = tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok((port, handle))
}
