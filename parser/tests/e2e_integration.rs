// --- E2E Test 1: HTML+CSS real con combinadores ---
#[test]
fn test_e2e_html_css_with_combinators() {
    let html = r#"
        <div class="container">
            <header>
                <nav>
                    <a href="/">Home</a>
                </nav>
            </header>
            <section class="main">
                <p>Hello</p>
            </section>
            <footer>
                <p>Footer text</p>
            </footer>
        </div>
    "#;

    let css = r#"
        .container { width: 100%; }
        header nav { display: flex; }
        section.main > p { color: red; font-size: 16px; }
        footer p { color: gray; }
    "#;

    let msg = parser::pipeline::process_source(html, css);

    assert!(!msg.objects.is_empty(), "Should parse HTML objects");
    assert!(!msg.directives.is_empty(), "Should parse CSS directives");

    assert!(msg.directives.iter().any(|d| d.selector == ".container" && d.property == "width"));
    assert!(msg.directives.iter().any(|d| d.selector == "header nav" && d.property == "display"));
    assert!(msg.directives.iter().any(|d| d.selector == "section.main > p" && d.property == "color"));
    assert!(msg.directives.iter().any(|d| d.selector == "footer p" && d.property == "color"));

    let json = parser::pipeline::serialize_message(&msg).unwrap();
    let deserialized = parser::pipeline::deserialize_message(&json).unwrap();
    assert_eq!(msg, deserialized);
}

// --- E2E Test 2: Selectores inválidos mezclados con válidos ---
#[test]
fn test_e2e_invalid_selectors_mixed() {
    let html = "<div><p></p></div>";
    let css = r#"
        div { color: red; }
        [[[invalid { width: 100px; }
        p { font-size: 14px; }
    "#;

    let msg = parser::pipeline::process_source(html, css);

    assert!(msg.directives.iter().any(|d| d.selector == "div" && d.property == "color"));
    assert!(msg.directives.iter().any(|d| d.selector == "p" && d.property == "font-size"));
}

// --- E2E Test 3: Grouped selectors through full pipeline ---
#[test]
fn test_e2e_grouped_selectors_pipeline() {
    let html = "<div><p></p><span></span></div>";
    let css = "div, p, span { color: red; font-size: 16px; }";

    let msg = parser::pipeline::process_source(html, css);

    // 3 selectors × 2 declarations = 6 directives
    assert_eq!(msg.directives.len(), 6);

    let div_count = msg.directives.iter().filter(|d| d.selector == "div").count();
    let p_count = msg.directives.iter().filter(|d| d.selector == "p").count();
    let span_count = msg.directives.iter().filter(|d| d.selector == "span").count();
    assert_eq!(div_count, 2);
    assert_eq!(p_count, 2);
    assert_eq!(span_count, 2);
}
