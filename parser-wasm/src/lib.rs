use wasm_bindgen::prelude::*;

// Re-use the parser code directly (copy the pure functions to avoid tokio dependency)
mod html_parser;
mod css_parser;

use shared::RenderMessage;

/// Parse HTML + CSS and return a JSON RenderMessage.
/// Called from JavaScript with raw file contents.
#[wasm_bindgen]
pub fn parse(html: &str, css: &str) -> String {
    let objects = html_parser::parse_html(html);
    let directives = css_parser::parse_css(css);
    let msg = RenderMessage {
        objects,
        directives,
        timestamp: 0,
    };
    serde_json::to_string(&msg).unwrap_or_default()
}

/// Parse only HTML, return JSON array of ObjetoHtml.
#[wasm_bindgen]
pub fn parse_html_only(html: &str) -> String {
    let objects = html_parser::parse_html(html);
    serde_json::to_string(&objects).unwrap_or_default()
}

/// Parse only CSS, return JSON array of Directriz.
#[wasm_bindgen]
pub fn parse_css_only(css: &str) -> String {
    let directives = css_parser::parse_css(css);
    serde_json::to_string(&directives).unwrap_or_default()
}
