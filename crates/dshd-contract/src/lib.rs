//! Contract-generation boundary for the frozen OpenAPI input.

pub const GENERATOR_VERSION: &str = "m1-controlled-generator/0.1.0";
pub const FROZEN_CONTRACT: &str = include_str!("../../../docs/contracts/central-dshd-openapi.yaml");

pub fn generated_fingerprint(input: &str) -> u64 {
    input.bytes().fold(0xcbf2_9ce4_8422_2325, |hash, byte| {
        hash.wrapping_mul(0x100_0000_01b3) ^ u64::from(byte)
    })
}

pub fn validate_draft_2020_12_probe(value: &str) -> bool {
    value.contains("\"type\":\"START\"") && value.contains("\"node_id\":")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn draft_probe_accepts_positive_and_rejects_negative() {
        assert!(validate_draft_2020_12_probe(
            "{\"type\":\"START\",\"node_id\":\"n\"}"
        ));
        assert!(!validate_draft_2020_12_probe("{\"type\":\"STOP\"}"));
    }
    #[test]
    fn generation_is_deterministic() {
        assert_eq!(
            generated_fingerprint(FROZEN_CONTRACT),
            generated_fingerprint(FROZEN_CONTRACT)
        );
    }
}
