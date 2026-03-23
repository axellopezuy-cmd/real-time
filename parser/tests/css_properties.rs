use proptest::prelude::*;
use shared::Directriz;

// --- Generators ---

fn arb_selector() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("div".to_string()),
        Just("span".to_string()),
        Just(".main".to_string()),
        Just("#app".to_string()),
        Just("header".to_string()),
        Just("nav".to_string()),
        Just("footer".to_string()),
        Just("section".to_string()),
        Just("p".to_string()),
        Just(".container".to_string()),
    ]
}

fn arb_css_property() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("color".to_string()),
        Just("width".to_string()),
        Just("height".to_string()),
        Just("margin".to_string()),
        Just("padding".to_string()),
        Just("font-size".to_string()),
        Just("display".to_string()),
        Just("position".to_string()),
        Just("background-color".to_string()),
        Just("border".to_string()),
    ]
}

fn arb_css_value() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("red".to_string()),
        Just("blue".to_string()),
        Just("100%".to_string()),
        Just("50px".to_string()),
        Just("16px".to_string()),
        Just("flex".to_string()),
        Just("block".to_string()),
        Just("none".to_string()),
        Just("relative".to_string()),
        Just("10px".to_string()),
    ]
}

fn arb_directriz() -> impl Strategy<Value = Directriz> {
    (arb_selector(), arb_css_property(), arb_css_value()).prop_map(|(selector, property, value)| {
        Directriz { selector, property, value, source_file: None }
    })
}

fn arb_directriz_list() -> impl Strategy<Value = Vec<Directriz>> {
    prop::collection::vec(arb_directriz(), 1..8)
}

// --- Property 7: CSS round-trip ---
// Feature: real-time-mvp, Property 7: CSS round-trip
// Validates: Requirements 3.4, 3.5
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_css_round_trip(directives in arb_directriz_list()) {
        let css = parser::css_parser::pretty_print_css(&directives);
        let parsed = parser::css_parser::parse_css(&css);

        // Same number of directives
        prop_assert_eq!(
            parsed.len(),
            directives.len(),
            "Round-trip should preserve directive count"
        );

        // Each directive should match
        for (original, reparsed) in directives.iter().zip(parsed.iter()) {
            prop_assert_eq!(&original.selector, &reparsed.selector, "Selector mismatch");
            prop_assert_eq!(&original.property, &reparsed.property, "Property mismatch");
            prop_assert_eq!(&original.value, &reparsed.value, "Value mismatch");
        }
    }
}

// --- Property 6: CSS parsing produces correct directives ---
// Feature: real-time-mvp, Property 6: CSS parsing produces correct directives
// Validates: Requirements 3.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_css_parsing_produces_correct_directives(
        selector in arb_selector(),
        property in arb_css_property(),
        value in arb_css_value()
    ) {
        let css = format!("{} {{ {}: {}; }}", selector, property, value);
        let parsed = parser::css_parser::parse_css(&css);

        prop_assert_eq!(parsed.len(), 1, "Should produce exactly one directive");
        prop_assert_eq!(&parsed[0].selector, &selector, "Selector should match");
        prop_assert_eq!(&parsed[0].property, &property, "Property should match");
        prop_assert_eq!(&parsed[0].value, &value, "Value should match");
    }
}
