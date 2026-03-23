use std::path::{Path, PathBuf};

pub const IGNORED_DIRS: &[&str] = &["node_modules", ".git", "target", "dist", "build"];

/// Escanea recursivamente un directorio buscando archivos .html y .css,
/// excluyendo directorios ignorados.
pub fn scan_project(dir: &Path) -> Vec<PathBuf> {
    let mut results = Vec::new();
    scan_recursive(dir, &mut results);
    results.sort();
    results
}

fn scan_recursive(dir: &Path, results: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if IGNORED_DIRS.contains(&name) {
                    continue;
                }
            }
            scan_recursive(&path, results);
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if ext == "html" || ext == "css" {
                    results.push(path);
                }
            }
        }
    }
}
