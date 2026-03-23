use proptest::prelude::*;
use tempfile::TempDir;

// Feature: one-click-experience, Property 1: CLI directory resolution
// Validates: Requirements 1.4, 1.5

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// Property 1: For any valid path (absolute or relative), when passed as argument
    /// to the CLI, the resolved work directory SHALL match the canonical form of that path.
    /// When no argument is provided, the work directory SHALL be the current working directory.
    #[test]
    fn prop_cli_directory_resolution_with_path(subdir_name in "[a-z]{1,8}") {
        let tmp = TempDir::new().unwrap();
        let subdir = tmp.path().join(&subdir_name);
        std::fs::create_dir_all(&subdir).unwrap();

        let canonical = std::fs::canonicalize(&subdir).unwrap();
        let resolved = realtime_cli::cli::resolve_work_dir(Some(subdir.to_str().unwrap())).unwrap();

        prop_assert_eq!(resolved, canonical, "Resolved path must match canonical form");
    }

    /// When no argument is provided, resolve_work_dir uses cwd.
    #[test]
    fn prop_cli_no_arg_uses_cwd(_dummy in 0..1u8) {
        let resolved = realtime_cli::cli::resolve_work_dir(None).unwrap();
        let cwd = std::fs::canonicalize(std::env::current_dir().unwrap()).unwrap();
        prop_assert_eq!(resolved, cwd, "No-arg should resolve to cwd");
    }

    /// For any non-existent path, resolve_work_dir should return an error.
    #[test]
    fn prop_cli_nonexistent_dir_errors(name in "[a-z]{1,8}") {
        let path = format!("/tmp/nonexistent_realtime_test_{}", name);
        // Ensure it doesn't exist
        let _ = std::fs::remove_dir_all(&path);
        let result = realtime_cli::cli::resolve_work_dir(Some(&path));
        prop_assert!(result.is_err(), "Non-existent directory should error");
    }
}
