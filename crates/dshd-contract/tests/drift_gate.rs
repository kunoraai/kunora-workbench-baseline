use dshd_contract::{FROZEN_CONTRACT, generated_fingerprint};

#[test]
fn clean_generation_has_zero_drift() {
    let generated = generated_fingerprint(FROZEN_CONTRACT);
    assert_eq!(generated, generated_fingerprint(FROZEN_CONTRACT));
}

#[test]
fn isolated_schema_drift_is_detected() {
    let mut temporary_copy = FROZEN_CONTRACT.to_owned();
    temporary_copy.push_str("\n# isolated drift");
    assert_ne!(
        generated_fingerprint(FROZEN_CONTRACT),
        generated_fingerprint(&temporary_copy)
    );
}
