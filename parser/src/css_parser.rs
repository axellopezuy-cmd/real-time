use shared::Directriz;

/// Parsea un string CSS y genera una lista de Directrices.
/// Tolerante a errores: ignora sintaxis inválida.
pub fn parse_css(input: &str) -> Vec<Directriz> {
    let mut directives = Vec::new();
    let mut chars = input.chars().peekable();

    loop {
        skip_whitespace_and_comments(&mut chars);
        if chars.peek().is_none() {
            break;
        }

        // Read selector
        let selector = read_until(&mut chars, '{').trim().to_string();
        if selector.is_empty() || chars.peek().is_none() {
            // Skip invalid rule
            skip_until(&mut chars, '}');
            if chars.peek() == Some(&'}') {
                chars.next();
            }
            continue;
        }
        // Consume '{'
        if chars.peek() == Some(&'{') {
            chars.next();
        } else {
            continue;
        }

        // Read declarations until '}'
        loop {
            skip_whitespace_and_comments(&mut chars);
            if chars.peek() == Some(&'}') || chars.peek().is_none() {
                break;
            }

            let property = read_until(&mut chars, ':').trim().to_lowercase();
            if chars.peek() == Some(&':') {
                chars.next();
            } else {
                // Malformed declaration, skip to ; or }
                skip_until_any(&mut chars, &[';', '}']);
                if chars.peek() == Some(&';') {
                    chars.next();
                }
                continue;
            }

            let value = read_until_any(&mut chars, &[';', '}']).trim().to_string();
            if chars.peek() == Some(&';') {
                chars.next();
            }

            if !property.is_empty() && !value.is_empty() {
                // Split grouped selectors by comma and emit one Directriz per selector
                for sel in selector.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
                    directives.push(Directriz {
                        selector: sel.to_string(),
                        property: property.clone(),
                        value: value.clone(),
                        source_file: None,
                    });
                }
            }
        }

        // Consume '}'
        if chars.peek() == Some(&'}') {
            chars.next();
        }
    }

    directives
}

fn skip_whitespace_and_comments(chars: &mut std::iter::Peekable<std::str::Chars>) {
    loop {
        // Skip whitespace
        while chars.peek().map_or(false, |c| c.is_whitespace()) {
            chars.next();
        }
        // Skip /* ... */ comments
        if chars.peek() == Some(&'/') {
            let mut clone = chars.clone();
            clone.next();
            if clone.peek() == Some(&'*') {
                chars.next(); // consume /
                chars.next(); // consume *
                loop {
                    match chars.next() {
                        Some('*') if chars.peek() == Some(&'/') => {
                            chars.next();
                            break;
                        }
                        None => break,
                        _ => {}
                    }
                }
                continue;
            }
        }
        break;
    }
}

fn read_until(chars: &mut std::iter::Peekable<std::str::Chars>, stop: char) -> String {
    let mut result = String::new();
    while let Some(&c) = chars.peek() {
        if c == stop {
            break;
        }
        result.push(c);
        chars.next();
    }
    result
}

fn read_until_any(chars: &mut std::iter::Peekable<std::str::Chars>, stops: &[char]) -> String {
    let mut result = String::new();
    while let Some(&c) = chars.peek() {
        if stops.contains(&c) {
            break;
        }
        result.push(c);
        chars.next();
    }
    result
}

fn skip_until(chars: &mut std::iter::Peekable<std::str::Chars>, stop: char) {
    while let Some(&c) = chars.peek() {
        if c == stop {
            break;
        }
        chars.next();
    }
}

fn skip_until_any(chars: &mut std::iter::Peekable<std::str::Chars>, stops: &[char]) {
    while let Some(&c) = chars.peek() {
        if stops.contains(&c) {
            break;
        }
        chars.next();
    }
}

/// Pretty-prints una lista de Directrices a CSS válido.
/// Agrupa directrices consecutivas con misma property/value bajo selector agrupado.
pub fn pretty_print_css(directives: &[Directriz]) -> String {
    if directives.is_empty() {
        return String::new();
    }

    // Group consecutive directives with same property+value
    let mut output = String::new();
    let mut i = 0;
    let mut first_rule = true;
    while i < directives.len() {
        let d = &directives[i];
        // Collect consecutive directives with same property and value
        let mut selectors = vec![d.selector.clone()];
        let mut j = i + 1;
        while j < directives.len()
            && directives[j].property == d.property
            && directives[j].value == d.value
        {
            selectors.push(directives[j].selector.clone());
            j += 1;
        }
        if !first_rule {
            output.push('\n');
        }
        first_rule = false;
        let sel_str = selectors.join(", ");
        output.push_str(&format!("{} {{\n  {}: {};\n}}", sel_str, d.property, d.value));
        i = j;
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_rule() {
        let result = parse_css("div { color: red; }");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].selector, "div");
        assert_eq!(result[0].property, "color");
        assert_eq!(result[0].value, "red");
    }

    #[test]
    fn test_parse_multiple_declarations() {
        let result = parse_css("div { color: red; font-size: 16px; }");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].property, "color");
        assert_eq!(result[1].property, "font-size");
    }

    #[test]
    fn test_parse_multiple_rules() {
        let result = parse_css("div { color: red; } span { color: blue; }");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].selector, "div");
        assert_eq!(result[1].selector, "span");
    }

    #[test]
    fn test_parse_class_selector() {
        let result = parse_css(".main { width: 100%; }");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].selector, ".main");
    }

    #[test]
    fn test_tolerant_invalid_css() {
        let result = parse_css("div { color }");
        // Should not panic, malformed declaration is skipped
        assert!(result.is_empty());
    }

    #[test]
    fn test_empty_input() {
        let result = parse_css("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_pretty_print() {
        let directives = vec![
            Directriz { selector: "div".to_string(), property: "color".to_string(), value: "red".to_string(), source_file: None },
            Directriz { selector: "div".to_string(), property: "width".to_string(), value: "100%".to_string(), source_file: None },
        ];
        let css = pretty_print_css(&directives);
        assert!(css.contains("div {"));
        assert!(css.contains("color: red;"));
        assert!(css.contains("width: 100%;"));
    }

    #[test]
    fn test_parse_grouped_selectors() {
        let result = parse_css("div, span { color: red; }");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].selector, "div");
        assert_eq!(result[0].property, "color");
        assert_eq!(result[1].selector, "span");
        assert_eq!(result[1].property, "color");
    }

    #[test]
    fn test_parse_grouped_selectors_multiple_declarations() {
        let result = parse_css("div, span { color: red; font-size: 16px; }");
        assert_eq!(result.len(), 4);
        assert_eq!(result[0].selector, "div");
        assert_eq!(result[0].property, "color");
        assert_eq!(result[1].selector, "span");
        assert_eq!(result[1].property, "color");
        assert_eq!(result[2].selector, "div");
        assert_eq!(result[2].property, "font-size");
        assert_eq!(result[3].selector, "span");
        assert_eq!(result[3].property, "font-size");
    }

    #[test]
    fn test_parse_grouped_with_invalid_branch() {
        // Empty branch after comma should be filtered
        let result = parse_css("div, , span { color: red; }");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].selector, "div");
        assert_eq!(result[1].selector, "span");
    }
}
