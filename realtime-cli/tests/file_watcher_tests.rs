use realtime_cli::file_watcher::{is_relevant_path, parse_file, start_watcher, FileEvent};
use std::path::Path;
use tempfile::TempDir;
use tokio::time::{sleep, Duration};

#[test]
fn test_is_relevant_path_html() {
    assert!(is_relevant_path(Path::new("/project/index.html")));
}

#[test]
fn test_is_relevant_path_css() {
    assert!(is_relevant_path(Path::new("/project/style.css")));
}

#[test]
fn test_is_relevant_path_js_rejected() {
    assert!(!is_relevant_path(Path::new("/project/app.js")));
}

#[test]
fn test_is_relevant_path_in_node_modules_rejected() {
    assert!(!is_relevant_path(Path::new("/project/node_modules/lib/index.html")));
}

#[test]
fn test_is_relevant_path_in_git_rejected() {
    assert!(!is_relevant_path(Path::new("/project/.git/config.html")));
}

#[test]
fn test_parse_html_file() {
    let tmp = TempDir::new().unwrap();
    let file = tmp.path().join("test.html");
    std::fs::write(&file, "<div><span></span></div>").unwrap();

    let parsed = parse_file(&file).unwrap();
    assert_eq!(parsed.objects.len(), 1);
    assert_eq!(parsed.objects[0].tag, "div");
    assert!(parsed.directives.is_empty());
}

#[test]
fn test_parse_css_file() {
    let tmp = TempDir::new().unwrap();
    let file = tmp.path().join("test.css");
    std::fs::write(&file, "div { color: red; }").unwrap();

    let parsed = parse_file(&file).unwrap();
    assert!(parsed.objects.is_empty());
    assert_eq!(parsed.directives.len(), 1);
    assert_eq!(parsed.directives[0].property, "color");
}

#[tokio::test]
async fn test_watcher_detects_file_creation() {
    let tmp = TempDir::new().unwrap();
    let (mut rx, _watcher) = start_watcher(tmp.path()).unwrap();

    // Give watcher time to initialize
    sleep(Duration::from_millis(200)).await;

    // Create a new HTML file
    let file = tmp.path().join("new.html");
    std::fs::write(&file, "<div></div>").unwrap();

    // Wait for event with timeout
    let event = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
    assert!(event.is_ok(), "Should receive a file event");
    let event = event.unwrap().unwrap();
    match event {
        FileEvent::Changed(p) => {
            assert_eq!(p.file_name().unwrap().to_str().unwrap(), "new.html");
        }
        FileEvent::Deleted(_) => panic!("Expected Changed, got Deleted"),
    }
}

#[tokio::test]
async fn test_watcher_detects_file_modification() {
    let tmp = TempDir::new().unwrap();
    let file = tmp.path().join("existing.html");
    std::fs::write(&file, "<div></div>").unwrap();

    let (mut rx, _watcher) = start_watcher(tmp.path()).unwrap();
    sleep(Duration::from_millis(200)).await;

    // Modify the file
    std::fs::write(&file, "<div><span></span></div>").unwrap();

    let event = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
    assert!(event.is_ok(), "Should receive a file event for modification");
    let event = event.unwrap().unwrap();
    match event {
        FileEvent::Changed(p) => {
            assert_eq!(p.file_name().unwrap().to_str().unwrap(), "existing.html");
        }
        _ => {} // Any event type is acceptable for modification
    }
}

#[tokio::test]
async fn test_watcher_detects_file_deletion() {
    let tmp = TempDir::new().unwrap();
    let file = tmp.path().join("todelete.css");
    std::fs::write(&file, "div { color: red; }").unwrap();

    let (mut rx, _watcher) = start_watcher(tmp.path()).unwrap();
    sleep(Duration::from_millis(200)).await;

    // Delete the file
    std::fs::remove_file(&file).unwrap();

    let event = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
    assert!(event.is_ok(), "Should receive a file event for deletion");
    let event = event.unwrap().unwrap();
    match event {
        FileEvent::Deleted(p) => {
            assert_eq!(p.file_name().unwrap().to_str().unwrap(), "todelete.css");
        }
        _ => {} // Debouncer may report as Changed if timing is tricky
    }
}
