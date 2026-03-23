use proptest::prelude::*;

// --- Generators ---

fn arb_selector() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("div".to_string()),
        Just("span".to_string()),
        Just(".main".to_string()),
        Just("#app".to_string()),
        Just("header".to_string()),
        Just("p".to_string()),
        Just("section".to_string()),
        Just("footer".to_string()),
    ]
}

fn arb_css_property() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("color".to_string()),
        Just("width".to_string()),
        Just("height".to_string()),
        Just("font-size".to_string()),
        Just("display".to_string()),
    ]
}

fn arb_css_value() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("red".to_string()),
        Just("blue".to_string()),
        Just("100%".to_string()),
        Just("50px".to_string()),
        Just("16px".to_string()),
        Just("block".to_string()),
    ]
}

// --- Property 5: Expansión de selectores agrupados ---
// Validates: Requirements 3.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_grouped_selector_expansion(
        selectors in prop::collection::vec(arb_selector(), 1..5),
        declarations in prop::collection::vec(
            (arb_css_property(), arb_css_value()),
            1..4,
        ),
    ) {
        // Build CSS with grouped selectors
        let sel_str = selectors.join(", ");
        let decl_str: String = declarations.iter()
            .map(|(p, v)| format!("  {}: {};", p, v))
            .collect::<Vec<_>>()
            .join("\n");
        let css = format!("{} {{\n{}\n}}", sel_str, decl_str);

        let parsed = parser::css_parser::parse_css(&css);

        // Count non-empty selectors (may have duplicates)
        let non_empty_selectors: Vec<_> = selectors.iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        // Should produce N_selectors × N_declarations directives
        let expected_count = non_empty_selectors.len() * declarations.len();
        prop_assert_eq!(
            parsed.len(), expected_count,
            "Expected {} selectors × {} declarations = {} directives, got {}",
            non_empty_selectors.len(), declarations.len(), expected_count, parsed.len()
        );

        // Every parsed directive should have a non-empty selector
        for d in &parsed {
            prop_assert!(
                !d.selector.is_empty(),
                "No directive should have an empty selector"
            );
        }
    }
}

// --- Property 6: Round-trip de selectores agrupados ---
// Validates: Requirements 3.4
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_grouped_selector_round_trip(
        selectors in prop::collection::vec(arb_selector(), 1..4),
        property in arb_css_property(),
        value in arb_css_value(),
    ) {
        // Build CSS with grouped selectors
        let sel_str = selectors.join(", ");
        let css = format!("{} {{ {}: {}; }}", sel_str, property, value);

        // Parse → pretty-print → parse
        let parsed1 = parser::css_parser::parse_css(&css);
        let printed = parser::css_parser::pretty_print_css(&parsed1);
        let parsed2 = parser::css_parser::parse_css(&printed);

        // Same number of directives
        prop_assert_eq!(
            parsed1.len(), parsed2.len(),
            "Round-trip should preserve directive count"
        );

        // Same content (ignoring source_file)
        for (a, b) in parsed1.iter().zip(parsed2.iter()) {
            prop_assert_eq!(&a.selector, &b.selector, "Selector mismatch in round-trip");
            prop_assert_eq!(&a.property, &b.property, "Property mismatch in round-trip");
            prop_assert_eq!(&a.value, &b.value, "Value mismatch in round-trip");
        }
    }
}

// --- Property 7: Tolerancia a ramas inválidas en grupos ---
// Validates: Requirements 3.2
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_invalid_branches_in_groups(
        valid_selectors in prop::collection::vec(arb_selector(), 1..3),
        property in arb_css_property(),
        value in arb_css_value(),
    ) {
        // Mix valid selectors with empty branches (invalid)
        let mut parts: Vec<String> = Vec::new();
        for sel in &valid_selectors {
            parts.push(sel.clone());
            parts.push(String::new()); // empty branch
        }
        let sel_str = parts.join(", ");
        let css = format!("{} {{ {}: {}; }}", sel_str, property, value);

        let parsed = parser::css_parser::parse_css(&css);

        // Only valid (non-empty) selectors should produce directives
        prop_assert_eq!(
            parsed.len(), valid_selectors.len(),
            "Only valid selectors should produce directives"
        );

        // No directive should have an empty selector
        for d in &parsed {
            prop_assert!(
                !d.selector.is_empty(),
                "No directive should have an empty selector"
            );
        }
    }
}
