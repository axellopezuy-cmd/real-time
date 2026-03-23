use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

/// Estado del relay: almacena el último mensaje para re-inyección al reconectar.
struct RelayState {
    last_message: Option<Message>,
}

/// Inicia el relay server en el puerto dado.
/// Acepta conexiones de productores (IDE/Parser) y consumidores (Browser).
/// Los productores envían mensajes que se retransmiten a todos los consumidores.
pub async fn start_relay(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(addr).await?;
    let (tx, _) = broadcast::channel::<Message>(64);
    let state = Arc::new(Mutex::new(RelayState { last_message: None }));

    println!("Relay server listening on {}", addr);

    while let Ok((stream, peer)) = listener.accept().await {
        let tx = tx.clone();
        let mut rx = tx.subscribe();
        let state = state.clone();

        tokio::spawn(async move {
            let ws = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(e) => {
                    eprintln!("WebSocket handshake failed for {}: {}", peer, e);
                    return;
                }
            };

            let (mut ws_sink, mut ws_stream) = ws.split();

            // Send last message on connect (re-injection on reconnect)
            {
                let s = state.lock().await;
                if let Some(ref msg) = s.last_message {
                    let _ = ws_sink.send(msg.clone()).await;
                }
            }

            // Spawn reader: messages from this client get broadcast
            let tx_clone = tx.clone();
            let state_clone = state.clone();
            let read_task = tokio::spawn(async move {
                while let Some(Ok(msg)) = ws_stream.next().await {
                    if msg.is_text() || msg.is_binary() {
                        // Store as last message for reconnection
                        {
                            let mut s = state_clone.lock().await;
                            s.last_message = Some(msg.clone());
                        }
                        // Broadcast to all consumers (relay transparency)
                        let _ = tx_clone.send(msg);
                    }
                }
            });

            // Spawn writer: broadcast messages go to this client
            let write_task = tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    if ws_sink.send(msg).await.is_err() {
                        break;
                    }
                }
            });

            let _ = tokio::join!(read_task, write_task);
        });
    }

    Ok(())
}

/// Función de relay puro para testing: toma bytes de entrada y los retorna sin modificar.
/// Simula la transparencia del relay sin necesidad de WebSocket.
pub fn relay_passthrough(input: &[u8]) -> Vec<u8> {
    input.to_vec()
}
