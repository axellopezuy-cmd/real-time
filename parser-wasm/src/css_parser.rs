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

