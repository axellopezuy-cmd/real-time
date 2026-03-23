use proptest::prelude::*;
use realtime_cli::consolidator::{MessageConsolidator, ParsedFile};
use shared::{Directriz, ObjetoHtml};
use std::path::PathBuf;

// --- E2E Test: Múltiples archivos CSS con conflictos ---
#[test]
fn test_e2e_multiple_files_with_conflicts() {
    let html = "<div class=\"main\"><p></p></div>";
    let css_a = "div { color: red; }";
    let css_b = ".main { color: blue; }";

    let objects = parser::html_parser::parse_html(html);

    let file_a = ParsedFile {
        path: PathBuf::from("/project/a.css"),
        objects: objects.clone(),
        directives: parser::css_parser::parse_css(css_a),
    };

    let file_b = ParsedFile {
        path: PathBuf::from("/project/b.css"),
        objects: vec![],
        directives: parser::css_parser::parse_css(css_b),
    };

    let mut consolidator = MessageConsolidator::new();
    consolidator.update_file(file_a);
    let msg = consolidator.update_file(file_b);

    assert!(msg.directives.iter().any(|d| d.selector == "div" && d.value == "red"));
    assert!(msg.directives.iter().any(|d| d.selector == ".main" && d.value == "blue"));

    for dir in &msg.directives {
        assert!(dir.source_file.is_some(), "All directives should have source_file");
    }

    for obj in &msg.objects {
        assert!(obj.source_file.is_some(), "All objects should have source_file");
    }
}

// --- Property 13: Orden determinista del Consolidator ---
// Validates: Requirements 11.4
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_consolidator_deterministic_order(
        objects_a in prop::collection::vec(
            "[a-z]{4,8}".prop_map(|id| ObjetoHtml {
                id, tag: "div".to_string(), children: vec![], attributes: vec![], source_file: None,
            text_content: None, }),
            1..3,
        ),
        objects_b in prop::collection::vec(
            "[a-z]{4,8}".prop_map(|id| ObjetoHtml {
                id, tag: "span".to_string(), children: vec![], attributes: vec![], source_file: None,
            text_content: None, }),
            1..3,
        ),
        dirs_a in prop::collection::vec(
            Just(Directriz { selector: "div".to_string(), property: "color".to_string(), value: "red".to_string(), source_file: None }),
            1..3,
        ),
        dirs_b in prop::collection::vec(
            Just(Directriz { selector: "span".to_string(), property: "color".to_string(), value: "blue".to_string(), source_file: None }),
            1..3,
        ),
    ) {
        let file_a = ParsedFile {
            path: PathBuf::from("/project/a.html"),
            objects: objects_a.clone(),
            directives: dirs_a.clone(),
        };
        let file_b = ParsedFile {
            path: PathBuf::from("/project/b.html"),
            objects: objects_b.clone(),
            directives: dirs_b.clone(),
        };

        // Insert in order A, B
        let mut c1 = MessageConsolidator::new();
        c1.update_file(file_a.clone());
        c1.update_file(file_b.clone());
        let msg1 = c1.consolidate();

        // Insert in order B, A
        let mut c2 = MessageConsolidator::new();
        c2.update_file(file_b);
        c2.update_file(file_a);
        let msg2 = c2.consolidate();

        // Output should be identical regardless of insertion order
        prop_assert_eq!(msg1.objects.len(), msg2.objects.len());
        prop_assert_eq!(msg1.directives.len(), msg2.directives.len());

        for (d1, d2) in msg1.directives.iter().zip(msg2.directives.iter()) {
            prop_assert_eq!(&d1.selector, &d2.selector);
            prop_assert_eq!(&d1.property, &d2.property);
            prop_assert_eq!(&d1.value, &d2.value);
        }
    }
}
