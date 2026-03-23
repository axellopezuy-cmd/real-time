use proptest::prelude::*;
use shared::ObjetoHtml;

// --- Generators ---

fn arb_tag() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("div".to_string()),
        Just("span".to_string()),
        Just("header".to_string()),
        Just("nav".to_string()),
        Just("footer".to_string()),
        Just("section".to_string()),
        Just("main".to_string()),
        Just("article".to_string()),
        Just("aside".to_string()),
        Just("p".to_string()),
    ]
}

fn arb_attr_name() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("class".to_string()),
        Just("id".to_string()),
        Just("role".to_string()),
        Just("data-x".to_string()),
    ]
}

fn arb_attr_value() -> impl Strategy<Value = String> {
    "[a-z][a-z0-9-]{0,10}".prop_map(|s| s)
}

fn arb_attributes() -> impl Strategy<Value = Vec<(String, String)>> {
    prop::collection::vec((arb_attr_name(), arb_attr_value()), 0..3)
}

fn arb_objeto_html_leaf() -> impl Strategy<Value = ObjetoHtml> {
    (arb_tag(), arb_attributes()).prop_map(|(tag, attributes)| ObjetoHtml {
        id: String::new(), // IDs are assigned by parser
        tag,
        children: vec![],
        attributes,
        source_file: None,
    text_content: None, })
}

fn arb_objeto_html() -> impl Strategy<Value = ObjetoHtml> {
    arb_objeto_html_leaf().prop_recursive(3, 16, 4, |inner| {
        (arb_tag(), arb_attributes(), prop::collection::vec(inner, 0..4)).prop_map(
            |(tag, attributes, children)| ObjetoHtml {
                id: String::new(),
                tag,
                children,
                attributes,
                source_file: None,
            text_content: None, },
        )
    })
}

/// Strips IDs from an ObjetoHtml tree for structural comparison.
fn strip_ids(node: &ObjetoHtml) -> ObjetoHtml {
    ObjetoHtml {
        id: String::new(),
        tag: node.tag.clone(),
        children: node.children.iter().map(strip_ids).collect(),
        attributes: node.attributes.clone(),
        source_file: None,
    text_content: None, }
}

fn strip_ids_vec(nodes: &[ObjetoHtml]) -> Vec<ObjetoHtml> {
    nodes.iter().map(strip_ids).collect()
}

// --- Property 2: HTML round-trip ---
// Feature: real-time-mvp, Property 2: HTML round-trip
// Validates: Requirements 1.5, 1.6
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_html_round_trip(tree in arb_objeto_html()) {
        let html = parser::html_parser::pretty_print(&[tree.clone()]);
        let parsed = parser::html_parser::parse_html(&html);
        let original_stripped = strip_ids(&tree);
        let parsed_stripped = strip_ids_vec(&parsed);

        prop_assert_eq!(parsed_stripped.len(), 1, "Round-trip should produce exactly one root");
        prop_assert_eq!(&parsed_stripped[0], &original_stripped, "Round-trip should preserve structure");
    }
}

// --- Property 1: HTML parsing preserves structure ---
// Feature: real-time-mvp, Property 1: HTML parsing preserves structure
// Validates: Requirements 1.1, 1.2

/// Counts total nodes in a tree.
fn count_nodes(nodes: &[ObjetoHtml]) -> usize {
    nodes.iter().map(|n| 1 + count_nodes(&n.children)).sum()
}

/// Collects all tags in pre-order.
fn collect_tags(nodes: &[ObjetoHtml]) -> Vec<String> {
    let mut tags = Vec::new();
    for n in nodes {
        tags.push(n.tag.clone());
        tags.extend(collect_tags(&n.children));
    }
    tags
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_html_parsing_preserves_structure(tree in arb_objeto_html()) {
        // Print the tree to HTML, then parse it back
        let html = parser::html_parser::pretty_print(&[tree.clone()]);
        let parsed = parser::html_parser::parse_html(&html);

        // Same number of nodes
        let original_count = count_nodes(&[tree.clone()]);
        let parsed_count = count_nodes(&parsed);
        prop_assert_eq!(original_count, parsed_count, "Node count should be preserved");

        // Same tag structure (pre-order traversal)
        let original_tags = collect_tags(&[tree]);
        let parsed_tags = collect_tags(&parsed);
        prop_assert_eq!(original_tags, parsed_tags, "Tag order should be preserved");
    }
}

// --- Property 3: Tag removal produces correct tree ---
// Feature: real-time-mvp, Property 3: Tag removal produces correct tree
// Validates: Requirements 1.3

/// Collects all IDs in a tree.
fn collect_ids(nodes: &[ObjetoHtml]) -> Vec<String> {
    let mut ids = Vec::new();
    for n in nodes {
        ids.push(n.id.clone());
        ids.extend(collect_ids(&n.children));
    }
    ids
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_tag_removal_produces_correct_tree(tree in arb_objeto_html()) {
        // First, print and parse to get IDs assigned
        let html = parser::html_parser::pretty_print(&[tree]);
        let parsed = parser::html_parser::parse_html(&html);

        let all_ids = collect_ids(&parsed);
        prop_assume!(!all_ids.is_empty());

        // Pick a random ID to remove (use first for determinism in property)
        let target_id = &all_ids[0];

        let result = parser::html_parser::remove_node_by_id(&parsed, target_id);

        // The removed ID should not appear anywhere in the result
        let remaining_ids = collect_ids(&result);
        prop_assert!(
            !remaining_ids.contains(target_id),
            "Removed node ID should not exist in result tree"
        );

        // Total nodes should decrease by at least 1
        let original_count = count_nodes(&parsed);
        let result_count = count_nodes(&result);
        prop_assert!(
            result_count < original_count,
            "Result tree should have fewer nodes after removal"
        );
    }
}
