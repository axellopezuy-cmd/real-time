use shared::RenderMessage;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::css_parser;
use crate::html_parser;

/// Procesa código fuente HTML y CSS, genera un RenderMessage serializable.
pub fn process_source(html: &str, css: &str) -> RenderMessage {
    let objects = html_parser::parse_html(html);
    let directives = css_parser::parse_css(css);
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

/// Serializa un RenderMessage a JSON string.
pub fn serialize_message(msg: &RenderMessage) -> Result<String, serde_json::Error> {
    serde_json::to_string(msg)
}

/// Deserializa un JSON string a RenderMessage.
pub fn deserialize_message(json: &str) -> Result<RenderMessage, serde_json::Error> {
    serde_json::from_str(json)
}

/// Envía un RenderMessage al relay via WebSocket.
pub async fn send_to_relay(
    msg: &RenderMessage,
    relay_url: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use futures_util::SinkExt;
    use tokio_tungstenite::connect_async;

    let json = serialize_message(msg)?;
    let (mut ws, _) = connect_async(relay_url).await?;
    ws.send(tokio_tungstenite::tungstenite::Message::Text(json.into()))
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::pipeline::{deserialize_message, process_source, serialize_message};
    use shared::{Directriz, ObjetoHtml, RenderMessage};

    #[test]
    fn test_process_source() {
        let msg = process_source("<div></div>", "div { color: red; }");
        assert_eq!(msg.objects.len(), 1);
        assert_eq!(msg.objects[0].tag, "div");
        assert_eq!(msg.directives.len(), 1);
        assert_eq!(msg.directives[0].property, "color");
    }

    #[test]
    fn test_serialize_deserialize() {
        let msg = RenderMessage {
            objects: vec![ObjetoHtml {
                id: "1".to_string(),
                tag: "div".to_string(),
                children: vec![],
                attributes: vec![],
                source_file: None,
            text_content: None, }],
            directives: vec![Directriz {
                selector: "div".to_string(),
                property: "color".to_string(),
                value: "red".to_string(),
                source_file: None,
            }],
            timestamp: 12345,
        };
        let json = serialize_message(&msg).unwrap();
        let deserialized = deserialize_message(&json).unwrap();
        assert_eq!(msg, deserialized);
    }
}
