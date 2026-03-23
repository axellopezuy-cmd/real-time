use proptest::prelude::*;

// --- Property 11: Relay transparency ---
// Feature: real-time-mvp, Property 11: Relay transparency
// Validates: Requirements 5.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_relay_transparency(input in prop::collection::vec(any::<u8>(), 0..1024)) {
        let output = relay::server::relay_passthrough(&input);
        prop_assert_eq!(
            &input, &output,
            "Relay output must be identical to input (zero transformation)"
        );
    }
}
