use shared::ObjetoHtml;
use uuid::Uuid;

/// Parsea un string HTML y genera un árbol de ObjetoHtml.
/// Tolerante a errores: ignora sintaxis inválida y produce el mejor árbol parcial posible.
pub fn parse_html(input: &str) -> Vec<ObjetoHtml> {
    let tokens = tokenize(input);
    build_tree(&tokens)
}

#[derive(Debug, Clone)]
enum Token {
    OpenTag {
        tag: String,
        attributes: Vec<(String, String)>,
        self_closing: bool,
    },
    CloseTag {
        tag: String,
    },
    Text(String),
}

const VOID_ELEMENTS: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
];

fn tokenize(input: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();

    while let Some(&ch) = chars.peek() {
        if ch == '<' {
            chars.next();
            // Skip whitespace after <
            while chars.peek().map_or(false, |c| c.is_whitespace()) {
                chars.next();
            }
            if chars.peek() == Some(&'/') {
                // Close tag
                chars.next();
                let tag = read_tag_name(&mut chars);
                // Skip until >
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if c == '>' {
                        break;
                    }
                }
                if !tag.is_empty() {
                    tokens.push(Token::CloseTag { tag: tag.to_lowercase() });
                }
            } else if chars.peek() == Some(&'!') || chars.peek() == Some(&'?') {
                // Comment or doctype — skip until >
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if c == '>' {
                        break;
                    }
                }
            } else {
                // Open tag
                let tag = read_tag_name(&mut chars);
                if tag.is_empty() {
                    continue;
                }
                let tag_lower = tag.to_lowercase();
                let attributes = read_attributes(&mut chars);
                let mut self_closing = false;

                // Check for self-closing /> or just >
                skip_whitespace(&mut chars);
                if chars.peek() == Some(&'/') {
                    chars.next();
                    self_closing = true;
                }
                if chars.peek() == Some(&'>') {
                    chars.next();
                }

                if VOID_ELEMENTS.contains(&tag_lower.as_str()) {
                    self_closing = true;
                }

                tokens.push(Token::OpenTag {
                    tag: tag_lower,
                    attributes,
                    self_closing,
                });
            }
        } else {
            // Capture text content
            let mut text = String::new();
            while let Some(&c) = chars.peek() {
                if c == '<' { break; }
                text.push(c);
                chars.next();
            }
            let trimmed = text.trim().to_string();
            if !trimmed.is_empty() {
                tokens.push(Token::Text(trimmed));
            }
        }
    }
    tokens
}

fn read_tag_name(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    let mut name = String::new();
    while let Some(&c) = chars.peek() {
        if c.is_alphanumeric() || c == '-' || c == '_' {
            name.push(c);
            chars.next();
        } else {
            break;
        }
    }
    name
}

fn skip_whitespace(chars: &mut std::iter::Peekable<std::str::Chars>) {
    while chars.peek().map_or(false, |c| c.is_whitespace()) {
        chars.next();
    }
}

fn read_attributes(chars: &mut std::iter::Peekable<std::str::Chars>) -> Vec<(String, String)> {
    let mut attrs = Vec::new();
    loop {
        skip_whitespace(chars);
        match chars.peek() {
            None | Some(&'>') | Some(&'/') => break,
            _ => {}
        }
        // Read attribute name
        let mut name = String::new();
        while let Some(&c) = chars.peek() {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                name.push(c);
                chars.next();
            } else {
                break;
            }
        }
        if name.is_empty() {
            // Skip invalid char
            chars.next();
            continue;
        }
        skip_whitespace(chars);
        let value = if chars.peek() == Some(&'=') {
            chars.next();
            skip_whitespace(chars);
            read_attr_value(chars)
        } else {
            String::new()
        };
        attrs.push((name.to_lowercase(), value));
    }
    attrs
}

fn read_attr_value(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    match chars.peek() {
        Some(&'"') => {
            chars.next();
            let mut val = String::new();
            while let Some(&c) = chars.peek() {
                chars.next();
                if c == '"' { break; }
                val.push(c);
            }
            val
        }
        Some(&'\'') => {
            chars.next();
            let mut val = String::new();
            while let Some(&c) = chars.peek() {
                chars.next();
                if c == '\'' { break; }
                val.push(c);
            }
            val
        }
        _ => {
            let mut val = String::new();
            while let Some(&c) = chars.peek() {
                if c.is_whitespace() || c == '>' || c == '/' { break; }
                val.push(c);
                chars.next();
            }
            val
        }
    }
}

fn build_tree(tokens: &[Token]) -> Vec<ObjetoHtml> {
    let mut roots: Vec<ObjetoHtml> = Vec::new();
    let mut stack: Vec<ObjetoHtml> = Vec::new();
    let mut i = 0;

    while i < tokens.len() {
        match &tokens[i] {
            Token::OpenTag { tag, attributes, self_closing } => {
                let node = ObjetoHtml {
                    id: Uuid::new_v4().to_string(),
                    tag: tag.clone(),
                    children: Vec::new(),
                    attributes: attributes.clone(),
                    source_file: None,
                    text_content: None,
                };
                if *self_closing {
                    if let Some(parent) = stack.last_mut() {
                        parent.children.push(node);
                    } else {
                        roots.push(node);
                    }
                } else {
                    stack.push(node);
                }
            }
            Token::CloseTag { tag } => {
                // Find matching open tag in stack (tolerant: skip mismatches)
                if let Some(pos) = stack.iter().rposition(|n| n.tag == *tag) {
                    // Pop everything from pos to end
                    let mut to_close: Vec<ObjetoHtml> = stack.drain(pos..).collect();
                    // The first one is the matching tag, rest are unclosed children
                    let mut node = to_close.remove(0);
                    // Unclosed tags become children of the matched node
                    node.children.extend(to_close);
                    if let Some(parent) = stack.last_mut() {
                        parent.children.push(node);
                    } else {
                        roots.push(node);
                    }
                }
                // If no match found, ignore the close tag (tolerance)
            }
            Token::Text(text) => {
                // Attach text to the current open tag on the stack
                if let Some(parent) = stack.last_mut() {
                    if parent.text_content.is_none() {
                        parent.text_content = Some(text.clone());
                    } else {
                        let existing = parent.text_content.as_mut().unwrap();
                        existing.push(' ');
                        existing.push_str(text);
                    }
                }
            }
        }
        i += 1;
    }

    // Any remaining unclosed tags become roots
    while let Some(node) = stack.pop() {
        if let Some(parent) = stack.last_mut() {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }

    roots
}

/// Pretty-prints un árbol de ObjetoHtml a HTML válido.
pub fn pretty_print(nodes: &[ObjetoHtml]) -> String {
    let mut output = String::new();
    for node in nodes {
        print_node(node, 0, &mut output);
    }
    output.trim_end().to_string()
}

fn print_node(node: &ObjetoHtml, indent: usize, output: &mut String) {
    let pad = "  ".repeat(indent);
    let mut tag_open = format!("{}<{}", pad, node.tag);
    for (key, value) in &node.attributes {
        if value.is_empty() {
            tag_open.push_str(&format!(" {}", key));
        } else {
            tag_open.push_str(&format!(" {}=\"{}\"", key, value));
        }
    }

    if VOID_ELEMENTS.contains(&node.tag.as_str()) {
        tag_open.push_str(" />");
        output.push_str(&tag_open);
        output.push('\n');
        return;
    }

    tag_open.push('>');
    output.push_str(&tag_open);
    output.push('\n');

    for child in &node.children {
        print_node(child, indent + 1, output);
    }

    output.push_str(&format!("{}</{}>\n", pad, node.tag));
}

/// Elimina un nodo con el ID dado del árbol. Retorna el árbol sin ese nodo.
pub fn remove_node_by_id(nodes: &[ObjetoHtml], target_id: &str) -> Vec<ObjetoHtml> {
    nodes
        .iter()
        .filter(|n| n.id != target_id)
        .map(|n| ObjetoHtml {
            id: n.id.clone(),
            tag: n.tag.clone(),
            children: remove_node_by_id(&n.children, target_id),
            attributes: n.attributes.clone(),
            source_file: n.source_file.clone(),
            text_content: n.text_content.clone(),
        })
        .collect()
}

/// Busca un nodo por ID en el árbol.
pub fn find_node_by_id<'a>(nodes: &'a [ObjetoHtml], target_id: &str) -> Option<&'a ObjetoHtml> {
    for node in nodes {
        if node.id == target_id {
            return Some(node);
        }
        if let Some(found) = find_node_by_id(&node.children, target_id) {
            return Some(found);
        }
    }
    None
}

