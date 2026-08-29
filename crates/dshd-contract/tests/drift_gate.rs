use std::process::Command;

#[test]
fn clean_generation_has_zero_drift() {
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let status = Command::new("cargo")
        .current_dir(workspace)
        .args(["run", "--locked", "-p", "contract-gen", "--", "--check"])
        .status()
        .expect("run shared contract generator");
    assert!(status.success());
}
