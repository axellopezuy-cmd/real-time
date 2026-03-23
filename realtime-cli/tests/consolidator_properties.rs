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
        Just("p".to_string()),
    ]
}

fn arb_objeto() -> impl Strategy<Value = ObjetoHtml> {
    (arb_tag(), "[a-z]{4,8}").prop_map(|(tag, id)| ObjetoHtml {
        id,
        tag,
        children: vec![],
        attributes: vec![],
        source_file: None,
    text_content: None, })
}

fn arb_directriz() -> impl Strategy<Value = Directriz> {
    (
        prop_oneof![Just("div".to_string()), Just(".main".to_string())],
        prop_oneof![Just("color".to_string()), Just("width".to_string())],
        prop_oneof![Just("red".to_string()), Just("100%".to_string())],
    )
        .prop_map(|(selector, property, value)| Directriz { selector, property, value, source_file: None })
}

fn arb_parsed_file(idx: usize) -> impl Strategy<Value = ParsedFile> {
    (
        prop::collection::vec(arb_objeto(), 0..4),
        prop::collection::vec(arb_directriz(), 0..4),
    )
        .prop_map(move |(objects, directives)| ParsedFile {
            path: PathBuf::from(format!("/fake/file{}.html", idx)),
            objects,
            directives,
        })
}

fn arb_parsed_files() -> impl Strategy<Value = Vec<ParsedFile>> {
    (0..5u8).prop_flat_map(|count| {
        let strategies: Vec<_> = (0..count as usize).map(arb_parsed_file).collect();
        strategies
    })
}

// Feature: one-click-experience, Property 7: Consolidation includes all objects and directives
// Validates: Requirements 5.1, 5.2
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_consolidation_includes_all_objects_and_directives(
        files in arb_parsed_files()
    ) {
        let mut consolidator = MessageConsolidator::new();
        for file in &files {
            consolidator.update_file(file.clone());
        }
        let msg = consolidator.consolidate();

        // Total objects should equal sum of all file objects
        let expected_obj_count: usize = files.iter().map(|f| f.objects.len()).sum();
        prop_assert_eq!(
            msg.objects.len(), expected_obj_count,
            "Consolidated message should contain all objects from all files"
        );

        // Total directives should equal sum of all file directives
        let expected_dir_count: usize = files.iter().map(|f| f.directives.len()).sum();
        prop_assert_eq!(
            msg.directives.len(), expected_dir_count,
            "Consolidated message should contain all directives from all files"
        );
    }
}

// Feature: one-click-experience, Property 4: File upsert updates consolidated message
// Validates: Requirements 3.2, 3.3
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_file_upsert_updates_consolidated(
        initial in arb_parsed_file(0),
        updated_objects in prop::collection::vec(arb_objeto(), 1..5),
        updated_directives in prop::collection::vec(arb_directriz(), 1..5),
    ) {
        let mut consolidator = MessageConsolidator::new();
        consolidator.update_file(initial.clone());

        // Update the same file with new content
        let updated = ParsedFile {
            path: initial.path.clone(),
            objects: updated_objects.clone(),
            directives: updated_directives.clone(),
        };
        let msg = consolidator.update_file(updated);

        // The consolidated message should reflect the updated content
        prop_assert_eq!(
            msg.objects.len(), updated_objects.len(),
            "After upsert, object count should match updated file"
        );
        prop_assert_eq!(
            msg.directives.len(), updated_directives.len(),
            "After upsert, directive count should match updated file"
        );
    }
}

// Feature: one-click-experience, Property 5: File deletion removes from consolidated message
// Validates: Requirements 3.4
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_file_deletion_removes_from_consolidated(
        file_a in arb_parsed_file(0),
        file_b in arb_parsed_file(1),
    ) {
        let mut consolidator = MessageConsolidator::new();
        consolidator.update_file(file_a.clone());
        consolidator.update_file(file_b.clone());

        // Remove file_a
        let msg = consolidator.remove_file(&file_a.path);

        // Only file_b's content should remain
        prop_assert_eq!(
            msg.objects.len(), file_b.objects.len(),
            "After removing file_a, only file_b objects should remain"
        );
        prop_assert_eq!(
            msg.directives.len(), file_b.directives.len(),
            "After removing file_a, only file_b directives should remain"
        );
    }
}

// Feature: one-click-experience, Property 8: Incremental update preserves other files
// Validates: Requirements 5.3
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_incremental_update_preserves_other_files(
        file_a in arb_parsed_file(0),
        file_b in arb_parsed_file(1),
        new_objects in prop::collection::vec(arb_objeto(), 0..4),
        new_directives in prop::collection::vec(arb_directriz(), 0..4),
    ) {
        let mut consolidator = MessageConsolidator::new();
        consolidator.update_file(file_a.clone());
        consolidator.update_file(file_b.clone());

        // Snapshot file_b's directives before update
        let file_b_directives_before = file_b.directives.clone();

        // Update only file_a
        let updated_a = ParsedFile {
            path: file_a.path.clone(),
            objects: new_objects.clone(),
            directives: new_directives.clone(),
        };
        let msg = consolidator.update_file(updated_a);

        // file_b's directives should still be present (with source_file set by consolidator)
        // Since files are sorted by path, file_b's directives come after file_a's
        let file_b_directives_in_msg: Vec<_> = msg.directives
            .iter()
            .skip(new_directives.len())
            .cloned()
            .collect();

        prop_assert_eq!(
            file_b_directives_in_msg.len(), file_b_directives_before.len(),
            "file_b directive count should be preserved after updating file_a"
        );
        for (before, after) in file_b_directives_before.iter().zip(file_b_directives_in_msg.iter()) {
            // Compare selector/property/value (source_file is set by consolidator)
            prop_assert_eq!(&before.selector, &after.selector, "file_b selector should be unchanged");
            prop_assert_eq!(&before.property, &after.property, "file_b property should be unchanged");
            prop_assert_eq!(&before.value, &after.value, "file_b value should be unchanged");
        }
    }
}
