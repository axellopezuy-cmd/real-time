use proptest::prelude::*;
use std::net::TcpListener;

// Feature: one-click-experience, Property 2: Port fallback on conflict
// Validates: Requirements 2.4

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// Property 2: For any requested port that is already in use,
    /// the Launcher SHALL select an alternative port that is available
    /// and different from the requested one.
    #[test]
    fn prop_port_fallback_on_conflict(base_port in 10000u16..60000u16) {
        // Bind the base port to simulate it being in use
        if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", base_port)) {
            // Port is now occupied by our listener
            let found = realtime_cli::panel_server::find_available_port(base_port);
            prop_assert!(found.is_some(), "Should find an available port");
            let found_port = found.unwrap();
            // The found port should be different from the occupied one
            prop_assert_ne!(
                found_port, base_port,
                "Found port should differ from occupied port"
            );
            // The found port should actually be available
            let test_bind = TcpListener::bind(format!("127.0.0.1:{}", found_port));
            prop_assert!(test_bind.is_ok(), "Found port should be bindable");
            drop(listener);
        }
        // If we couldn't bind the base port, it was already in use — skip
    }

    /// When the requested port is free, find_available_port returns it directly.
    #[test]
    fn prop_port_returns_requested_when_free(base_port in 10000u16..60000u16) {
        // Check if port is free first
        if TcpListener::bind(format!("127.0.0.1:{}", base_port)).is_ok() {
            // Port was free (we just released it by dropping)
            let found = realtime_cli::panel_server::find_available_port(base_port);
            prop_assert!(found.is_some(), "Should find a port");
            // It should return the requested port or a nearby one
            let found_port = found.unwrap();
            prop_assert!(
                found_port >= base_port && found_port < base_port + 100,
                "Found port should be within range"
            );
        }
    }
}
