//! Generated DTOs and runtime validation for the frozen contract.

pub const GENERATOR_VERSION: &str = "m1-controlled-generator/0.2.0";
pub const FROZEN_CONTRACT: &str = include_str!("../../../docs/contracts/central-dshd-openapi.yaml");
pub mod generated;
pub use generated::*;

pub fn validate(schema: &serde_json::Value, instance: &serde_json::Value) -> bool {
    jsonschema::options()
        .with_draft(jsonschema::Draft::Draft202012)
        .build(schema)
        .is_ok_and(|validator| validator.is_valid(instance))
}

pub fn canonicalize(value: &serde_json::Value) -> Result<Vec<u8>, String> {
    canonical_json::to_vec(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn draft_2020_12_positive_and_negative() {
        let schema = serde_json::json!({"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["state"],"properties":{"state":{"const":"READY"}},"unevaluatedProperties":false});
        assert!(validate(&schema, &serde_json::json!({"state":"READY"})));
        assert!(!validate(&schema, &serde_json::json!({"state":"STOPPED"})));
    }
    #[test]
    fn official_jcs_style_vector() {
        let value: serde_json::Value = serde_json::from_str(r#"{"literals":[null,true,false],"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"€$\\u000f\\nA'B\"\\\\\"/"}"#).unwrap();
        let out = String::from_utf8(canonicalize(&value).unwrap()).unwrap();
        assert!(out.starts_with("{\"literals\":"));
        assert!(out.contains("333333333.3333333"));
    }
}
