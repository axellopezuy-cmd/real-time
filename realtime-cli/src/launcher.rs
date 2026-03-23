use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{broadcast, Mutex};

use crate::file_watcher::{start_watcher, FileEvent};
use crate::panel_server::{find_available_port, start_panel_server, AppState};
use crate::scanner::scan_project;

pub struct Launcher {
    pub work_dir: PathBuf,
    pub http_port: u16,
    pub no_open: bool,
}

impl Launcher {
    pub fn new(work_dir: PathBuf, http_port: u16, no_open: bool) -> Self {
        Self { work_dir, http_port, no_open }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let (tx, _) = broadcast::channel::<String>(64);
        let last_msg: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
        let raw_files: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));

        let state = AppState {
            tx: tx.clone(),
            last_msg: last_msg.clone(),
            raw_files: raw_files.clone(),
        };

        // Start panel server
        let http_port = find_available_port(self.http_port)
            .ok_or("No available port for panel server")?;
        let (_actual_port, _panel_handle) = start_panel_server(http_port, state).await?;
        let panel_url = format!("http://127.0.0.1:{}", http_port);
        println!("Panel browser en {}", panel_url);

        // Initial scan — read raw file contents
        let files = scan_project(&self.work_dir);
        println!("Escaneando {} archivos...", files.len());

        {
            let mut rf = raw_files.lock().await;
            for file_path in &files {
                if let Ok(content) = std::fs::read_to_string(file_path) {
                    let name = file_path.file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    rf.insert(name, content);
                }
            }
        }

        // Broadcast initial state
        self.broadcast_files(&tx, &last_msg, &raw_files).await;

        // Start file watcher
        let (mut rx, _watcher) = start_watcher(&self.work_dir)?;
        println!("Observando directorio: {}", self.work_dir.display());

        // Open browser
        if !self.no_open {
            if let Err(e) = webbrowser::open(&panel_url) {
                eprintln!("No se pudo abrir el browser: {}", e);
            }
        }

        println!("\nReal Time listo. Ctrl+C para salir.\n");

        // Shutdown handler
        let (shutdown_tx, mut shutdown_rx) = broadcast::channel::<()>(1);
        let shutdown_tx_clone = shutdown_tx.clone();
        tokio::spawn(async move {
            tokio::signal::ctrl_c().await.ok();
            let _ = shutdown_tx_clone.send(());
        });

        // Process file events — send raw content directly
        // Process file events — deduplicate rapid events per file
        let mut last_event_time: HashMap<String, Instant> = HashMap::new();

        loop {
            tokio::select! {
                Some(event) = rx.recv() => {
                    match event {
                        FileEvent::Changed(path) => {
                            let name = path.file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();

                            // Deduplicate: skip if same file changed <5ms ago
                            let now = Instant::now();
                            if let Some(last) = last_event_time.get(&name) {
                                if now.duration_since(*last).as_millis() < 5 {
                                    continue;
                                }
                            }
                            last_event_time.insert(name.clone(), now);

                            if let Ok(content) = std::fs::read_to_string(&path) {
                                {
                                    let mut rf = raw_files.lock().await;
                                    rf.insert(name.clone(), content.clone());
                                }
                                let mut delta = HashMap::new();
                                delta.insert(name.clone(), content);
                                let msg = serde_json::json!({ "files": delta }).to_string();
                                {
                                    let rf = raw_files.lock().await;
                                    let full = serde_json::json!({ "files": *rf }).to_string();
                                    let mut lm = last_msg.lock().await;
                                    *lm = Some(full);
                                }
                                let _ = tx.send(msg);
                                println!("→ {}", name);
                            }
                        }
                        FileEvent::Deleted(path) => {
                            let name = path.file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            {
                                let mut rf = raw_files.lock().await;
                                rf.remove(&name);
                            }
                            self.broadcast_files(&tx, &last_msg, &raw_files).await;
                            println!("✗ {}", name);
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    println!("\nShutdown...");
                    break;
                }
            }
        }

        Ok(())
    }

    async fn broadcast_files(
        &self,
        tx: &broadcast::Sender<String>,
        last_msg: &Arc<Mutex<Option<String>>>,
        raw_files: &Arc<Mutex<HashMap<String, String>>>,
    ) {
        let files = raw_files.lock().await;
        let msg = serde_json::json!({ "files": *files }).to_string();
        {
            let mut lm = last_msg.lock().await;
            *lm = Some(msg.clone());
        }
        let _ = tx.send(msg);
    }
}
