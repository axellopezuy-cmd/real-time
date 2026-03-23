use proptest::prelude::*;
use std::path::PathBuf;
use tempfile::TempDir;

// Feature: one-click-experience, Property 3: Recursive file scanning finds all HTML/CSS
// Validates: Requirements 3.1

fn arb_filename() -> impl Strategy<Value = String> {
    "[a-z]{1,6}"
}

fn arb_extension() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("html".to_string()),
        Just("css".to_string()),
    ]
}

fn arb_non_matching_extension() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("js".to_string()),
        Just("ts".to_string()),
        Just("txt".to_string()),
        Just("rs".to_string()),
        Just("json".to_string()),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// Property 3: For any directory tree containing .html and .css files at arbitrary depths,
    /// the Project_Scanner SHALL return exactly the set of .html and .css files present.
    #[test]
    fn prop_recursive_scanning_finds_all_html_css(
        html_files in prop::collection::vec((arb_filename(), 0..3u8), 1..5),
        css_files in prop::collection::vec((arb_filename(), 0..3u8), 1..5),
        other_files in prop::collection::vec((arb_filename(), arb_non_matching_extension()), 0..3),
    ) {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let mut expected: Vec<PathBuf> = Vec::new();

        // Create HTML files at various depths
        for (name, depth) in &html_files {
            let mut dir = root.to_path_buf();
            for i in 0..*depth {
                dir = dir.join(format!("sub{}", i));
            }
            std::fs::create_dir_all(&dir).unwrap();
            let file = dir.join(format!("{}.html", name));
            std::fs::write(&file, "<div></div>").unwrap();
            expected.push(std::fs::canonicalize(&file).unwrap());
        }

        // Create CSS files at various depths
        for (name, depth) in &css_files {
            let mut dir = root.to_path_buf();
            for i in 0..*depth {
                dir = dir.join(format!("sub{}", i));
            }
            std::fs::create_dir_all(&dir).unwrap();
            let file = dir.join(format!("{}.css", name));
            std::fs::write(&file, "div { color: red; }").unwrap();
            expected.push(std::fs::canonicalize(&file).unwrap());
        }

        // Create non-matching files (should NOT be found)
        for (name, ext) in &other_files {
            let file = root.join(format!("{}.{}", name, ext));
            std::fs::write(&file, "content").unwrap();
        }

        let found = realtime_cli::scanner::scan_project(root);
        expected.sort();
        expected.dedup();

        // Every expected file must be found
        for exp in &expected {
            prop_assert!(
                found.contains(exp),
                "Expected file {:?} not found in scan results", exp
            );
        }

        // Every found file must have .html or .css extension
        for f in &found {
            let ext = f.extension().and_then(|e| e.to_str()).unwrap_or("");
            prop_assert!(
                ext == "html" || ext == "css",
                "Found file {:?} has unexpected extension", f
            );
        }
    }

    /// Property 6: For any directory tree where some files are inside ignored directories,
    /// the Project_Scanner SHALL not include those files in the scan results.
    #[test]
    fn prop_ignored_directories_excluded(
        ignored_dir in prop_oneof![
            Just("node_modules"),
            Just(".git"),
            Just("target"),
            Just("dist"),
            Just("build"),
        ],
        filename in arb_filename(),
    ) {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();

        // Create a file inside an ignored directory
        let ignored_path = root.join(ignored_dir);
        std::fs::create_dir_all(&ignored_path).unwrap();
        let ignored_file = ignored_path.join(format!("{}.html", filename));
        std::fs::write(&ignored_file, "<div></div>").unwrap();

        // Create a file outside ignored directory (should be found)
        let normal_file = root.join(format!("{}.html", filename));
        std::fs::write(&normal_file, "<div></div>").unwrap();

        let found = realtime_cli::scanner::scan_project(root);

        // The ignored file should NOT be in results
        let ignored_canonical = std::fs::canonicalize(&ignored_file).unwrap();
        prop_assert!(
            !found.contains(&ignored_canonical),
            "File inside {:?} should be excluded", ignored_dir
        );

        // The normal file SHOULD be in results
        let normal_canonical = std::fs::canonicalize(&normal_file).unwrap();
        prop_assert!(
            found.contains(&normal_canonical),
            "File outside ignored dir should be found"
        );
    }
}
