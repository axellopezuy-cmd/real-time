use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use std::path::{Path, PathBuf};
use tokio::sync::mpsc;

use crate::consolidator::ParsedFile;
use crate::scanner::IGNORED_DIRS;

#[derive(Debug, Clone)]
pub enum FileEvent {
    Changed(PathBuf),
    Deleted(PathBuf),
}

pub fn is_relevant_path(path: &Path) -> bool {
    let ext = match path.extension().and_then(|e| e.to_str()) {
        Some(e) => e,
        None => return false,
    };
    if ext != "html" && ext != "css" {
        return false;
    }
    for component in path.components() {
        if let Some(name) = component.as_os_str().to_str() {
            if IGNORED_DIRS.contains(&name) {
                return false;
            }
        }
    }
    true
}

pub fn parse_file(path: &Path) -> Option<ParsedFile> {
    let content = std::fs::read_to_string(path).ok()?;
    let ext = path.extension().and_then(|e| e.to_str())?;
    match ext {
        "html" => {
            let objects = parser::html_parser::parse_html(&content);
            Some(ParsedFile {
                path: path.to_path_buf(),
                objects,
                directives: vec![],
            })
        }
        "css" => {
            let directives = parser::css_parser::parse_css(&content);
            Some(ParsedFile {
                path: path.to_path_buf(),
                objects: vec![],
                directives,
            })
        }
        _ => None,
    }
}

/// Raw inotify watcher — no debounce. Events fire immediately.
/// Deduplication happens in the consumer (launcher).
pub fn start_watcher(
    work_dir: &Path,
) -> Result<(mpsc::UnboundedReceiver<FileEvent>, RecommendedWatcher), Box<dyn std::error::Error>> {
    let (tx, rx) = mpsc::unbounded_channel();

    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            if let Ok(event) = result {
                for path in &event.paths {
                    if !is_relevant_path(path) {
                        continue;
                    }
                    let file_event = match event.kind {
                        EventKind::Remove(_) => FileEvent::Deleted(path.clone()),
                        _ => {
                            if path.exists() {
                                FileEvent::Changed(path.clone())
                            } else {
                                FileEvent::Deleted(path.clone())
                            }
                        }
                    };
                    let _ = tx.send(file_event);
                }
            }
        },
        Config::default(),
    )?;

    watcher.watch(work_dir, RecursiveMode::Recursive)?;
    println!("File watcher: raw inotify (zero debounce)");

    Ok((rx, watcher))
}
