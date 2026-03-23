use proptest::prelude::*;
use shared::{Directriz, ObjetoHtml, RenderMessage};

fn arb_tag() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("div".to_string()),
        Just("span".to_string()),
        Just("header".to_string()),
        Just("section".to_string()),
    ]
}

fn arb_objeto_html() -> impl Strategy<Value = ObjetoHtml> {
    (arb_tag(), "[a-z0-9]{4,8}").prop_map(|(tag, id)| ObjetoHtml {
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
        .prop_map(|(selector, property, value)| Directriz {
            selector,
            property,
            value,
            source_file: None,
        })
}

fn arb_render_message() -> impl Strategy<Value = RenderMessage> {
    (
        prop::collection::vec(arb_objeto_html(), 0..5),
        prop::collection::vec(arb_directriz(), 0..5),
        any::<u64>(),
    )
        .prop_map(|(objects, directives, timestamp)| RenderMessage {
            objects,
            directives,
            timestamp,
        })
}

// Feature: real-time-mvp, Property: Serialization round-trip
// Validates: Requirements 5.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_serialization_round_trip(msg in arb_render_message()) {
        let json = parser::pipeline::serialize_message(&msg).unwrap();
        let deserialized = parser::pipeline::deserialize_message(&json).unwrap();
        prop_assert_eq!(&msg, &deserialized, "Serialization round-trip must preserve data");
    }
}
