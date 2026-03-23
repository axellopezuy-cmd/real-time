use std::env;

#[tokio::main]
async fn main() {
    let addr = env::var("RELAY_ADDR").unwrap_or_else(|_| "127.0.0.1:9001".to_string());
    println!("Starting Real Time Relay on {}", addr);
    if let Err(e) = relay::server::start_relay(&addr).await {
        eprintln!("Relay error: {}", e);
    }
}
