use serde::{Deserialize, Serialize};

/// Representación interna de una etiqueta HTML como caja geométrica.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ObjetoHtml {
    pub id: String,
    pub tag: String,
    pub children: Vec<ObjetoHtml>,
    pub attributes: Vec<(String, String)>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_content: Option<String>,
}

/// Instrucción de estilo derivada del código CSS del desarrollador.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Directriz {
    pub selector: String,
    pub property: String,
    pub value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
}

/// Mensaje que se transmite del Parser Module al Panel Browser vía Relay.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RenderMessage {
    pub objects: Vec<ObjetoHtml>,
    pub directives: Vec<Directriz>,
    pub timestamp: u64,
}
