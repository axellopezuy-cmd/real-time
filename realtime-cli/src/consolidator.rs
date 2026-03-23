#![allow(dead_code)]
use shared::{Directriz, ObjetoHtml, RenderMessage};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Archivo parseado con sus objetos HTML y directrices CSS.
#[derive(Debug, Clone)]
pub struct ParsedFile {
    pub path: PathBuf,
    pub objects: Vec<ObjetoHtml>,
    pub directives: Vec<Directriz>,
}

/// Consolida múltiples archivos parseados en un solo RenderMessage.
pub struct MessageConsolidator {
    files: HashMap<PathBuf, ParsedFile>,
}

impl MessageConsolidator {
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
        }
    }

    /// Actualiza o inserta un archivo parseado y retorna el RenderMessage consolidado.
    pub fn update_file(&mut self, parsed: ParsedFile) -> RenderMessage {
        // Tag objects and directives with source file
        let mut tagged = parsed.clone();
        let source = tagged.path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        for obj in &mut tagged.objects {
            set_source_file(obj, &source);
        }
        for dir in &mut tagged.directives {
            dir.source_file = Some(source.clone());
        }
        self.files.insert(tagged.path.clone(), tagged);
        self.consolidate()
    }

    /// Elimina un archivo y retorna el RenderMessage consolidado.
    pub fn remove_file(&mut self, path: &Path) -> RenderMessage {
        self.files.remove(path);
        self.consolidate()
    }

    /// Combina todos los objetos y directrices de todos los archivos.
    pub fn consolidate(&self) -> RenderMessage {
        let mut objects = Vec::new();
        let mut directives = Vec::new();
        // Iterar en orden determinista por path
        let mut sorted_keys: Vec<&PathBuf> = self.files.keys().collect();
        sorted_keys.sort();
        for key in sorted_keys {
            let file = &self.files[key];
            objects.extend(file.objects.clone());
            directives.extend(file.directives.clone());
        }
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        RenderMessage {
            objects,
            directives,
            timestamp,
        }
    }

    pub fn file_count(&self) -> usize {
        self.files.len()
    }
}

fn set_source_file(obj: &mut ObjetoHtml, source: &str) {
    obj.source_file = Some(source.to_string());
    for child in &mut obj.children {
        set_source_file(child, source);
    }
}
