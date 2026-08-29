fn contract() -> &'static str {
    include_str!("../../../docs/contracts/central-dshd-openapi.yaml")
}
#[test]
fn deterministic_frozen_golden_fragments() {
    let a = super::render(contract()).unwrap();
    let b = super::render(contract()).unwrap();
    assert_eq!(a, b);
    let t = &a["types.rs"];
    assert!(t.contains("pub struct RegistrationRequest"));
    assert!(t.contains("pub predecessor_instance_id: Option<UuidV4>"));
    assert!(t.contains("pub enum HarnessState"));
    assert!(t.contains("#[serde(untagged)]"));
    assert!(t.contains("pub struct HarnessStatus"));
}
#[test]
fn schema_property_enum_and_union_changes_change_types() {
    let o = super::render(contract()).unwrap();
    let p = contract().replacen(
        "        build_sha:\n          type: string",
        "        build_number:\n          type: integer\n        build_sha:\n          type: string",
        1,
    );
    assert_ne!(o["types.rs"], super::render(&p).unwrap()["types.rs"]);
    let e = contract().replacen(
        "enum: [STARTING, READY, STOPPING]",
        "enum: [BOOTING, READY, STOPPING]",
        1,
    );
    assert_ne!(o["types.rs"], super::render(&e).unwrap()["types.rs"]);
    let u = contract().replacen(
        "            - type: 'null'",
        "            - type: string",
        1,
    );
    assert_ne!(o["types.rs"], super::render(&u).unwrap()["types.rs"]);
}
