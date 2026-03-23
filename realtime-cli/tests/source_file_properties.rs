use proptest::prelude::*;
use realtime_cli::consolidator::{MessageConsolidator, ParsedFile};
use shared::{Directriz, ObjetoHtml};
use std::path::PathBuf;

// --- Generators ---

fn arb_tag() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("div".to_string()),
        Just("span".to_string()),
        Just("header".to_string()),
        Just("section".to_string()),
    ]
}

fn arb_objeto() -> impl Strategy<Value = ObjetoHtml> {
    (arb_tag(), "[a-z]{4,8}").prop_map(|(tag, id)| ObjetoHtml {
        id,
        tag,
        children: vec![],
        attributes: vec![],
        source_file: None,
        text_content: None,
    })
}

fn arb_directriz() -> impl Strategy<Value = Directriz> {
    (
        prop_oneof![Just("div".to_string()), Just(".main".to_string())],
        prop_oneof![Just("color".to_string()), Just("width".to_string())],
        prop_oneof![Just("red".to_string()), Just("100%".to_string())],
    )
        .prop_map(|(selector, property, value)| Directriz {
            selector,
            property,
            value,
            source_file: None,
        })
}

fn arb_parsed_file(idx: usize) -> impl Strategy<Value = ParsedFile> {
    (
        prop::collection::vec(arb_objeto(), 1..4),
        prop::collection::vec(arb_directriz(), 1..4),
    )
        .prop_map(move |(objects, directives)| ParsedFile {
            path: PathBuf::from(format!("/project/file{}.html", idx)),
            objects,
            directives,
        })
}

// --- Property 1: source_file round-trip por archivo ---
// Validates: Requirements 1.3
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_source_file_round_trip(
        files in (0..4u8).prop_flat_map(|count| {
            let strategies: Vec<_> = (0..count as usize).map(arb_parsed_file).collect();
            strategies
        })
    ) {
        let mut consolidator = MessageConsolidator::new();
        for file in &files {
            consolidator.update_file(file.clone());
        }
        let msg = consolidator.consolidate();

        // Every object should have a source_file set
        for obj in &msg.objects {
            prop_assert!(
                obj.source_file.is_some(),
                "Every object should have source_file after consolidation"
            );
        }

        // Every directive should have a source_file set
        for dir in &msg.directives {
            prop_assert!(
                dir.source_file.is_some(),
                "Every directive should have source_file after consolidation"
            );
        }

        // Verify source_file matches the filename of the originating file
        for file in &files {
            let expected_source = file.path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            // Count directives from this file in the consolidated message
            let dir_count_in_msg = msg.directives.iter()
                .filter(|d| d.source_file.as_deref() == Some(&expected_source))
                .count();
            prop_assert_eq!(
                dir_count_in_msg,
                file.directives.len(),
                "Directive count for {} should match",
                expected_source
            );
        }
    }
}

// --- Property 2: Independencia parser/consolidator ---
// Validates: Requirements 1.2
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_parser_produces_no_source_file(
        css in prop_oneof![
            Just("div { color: red; }".to_string()),
            Just(".main { width: 100%; }".to_string()),
            Just("header { font-size: 16px; }".to_string()),
            Just("span { display: block; }".to_string()),
        ]
    ) {
        let directives = parser::css_parser::parse_css(&css);
        for dir in &directives {
            prop_assert!(
                dir.source_file.is_none(),
                "Parser should not set source_file — that's the Consolidator's job"
            );
        }
    }
}
