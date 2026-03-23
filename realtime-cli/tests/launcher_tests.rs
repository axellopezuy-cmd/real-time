use realtime_cli::panel_server::{find_available_port, start_panel_server, AppState};
use std::collections::HashMap;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::{broadcast, Mutex};

fn make_state() -> AppState {
    let (tx, _) = broadcast::channel::<String>(16);
    AppState {
        tx,
        last_msg: Arc::new(Mutex::new(None)),
        raw_files: Arc::new(Mutex::new(HashMap::new())),
    }
}

#[tokio::test]
async fn test_panel_server_starts() {
    let port = find_available_port(18000).expect("Should find a port");
    let state = make_state();

    let (actual_port, handle) = start_panel_server(port, state)
        .await
        .expect("Panel server should start");

    assert_eq!(actual_port, port);

    let result = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", actual_port)).await;
    assert!(result.is_ok(), "Panel server should accept TCP connections");

    handle.abort();
}

#[test]
fn test_scanner_with_empty_dir() {
    let tmp = TempDir::new().unwrap();
    let files = realtime_cli::scanner::scan_project(tmp.path());
    assert!(files.is_empty(), "Empty directory should return no files");
}

#[test]
fn test_full_pipeline_scan_parse_consolidate() {
    let tmp = TempDir::new().unwrap();

    std::fs::write(tmp.path().join("index.html"), "<div><span></span></div>").unwrap();
    std::fs::write(tmp.path().join("style.css"), "div { color: red; }").unwrap();

    let files = realtime_cli::scanner::scan_project(tmp.path());
    assert_eq!(files.len(), 2);

    let mut consolidator = realtime_cli::consolidator::MessageConsolidator::new();
    for file_path in &files {
        if let Some(parsed) = realtime_cli::file_watcher::parse_file(file_path) {
            consolidator.update_file(parsed);
        }
    }

    let msg = consolidator.consolidate();
    assert!(!msg.objects.is_empty(), "Should have parsed HTML objects");
    assert!(!msg.directives.is_empty(), "Should have parsed CSS directives");
    assert_eq!(consolidator.file_count(), 2);
}
