use futures_util::SinkExt;
use std::env;
use std::io::{self, Read};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let relay_url = env::var("RELAY_URL").unwrap_or_else(|_| "ws://127.0.0.1:9001".to_string());

    // Read HTML and CSS from stdin (pipe-friendly)
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;

    // Split input: first section is HTML, second (after ---) is CSS
    let parts: Vec<&str> = input.splitn(2, "---").collect();
    let html = parts.first().unwrap_or(&"").trim();
    let css = parts.get(1).unwrap_or(&"").trim();

    let msg = parser::pipeline::process_source(html, css);
    let json = parser::pipeline::serialize_message(&msg)?;

    let (mut ws, _) = connect_async(&relay_url).await?;
    ws.send(Message::Text(json.into())).await?;

    println!("Sent RenderMessage with {} objects and {} directives", msg.objects.len(), msg.directives.len());
    Ok(())
}
