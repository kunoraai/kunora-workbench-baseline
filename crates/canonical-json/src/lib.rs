//! Pinned RFC 8785 adapter used by the contract boundary.
pub fn to_vec(value: &serde_json::Value) -> Result<Vec<u8>, String> {
    acdp_jcs::try_canonicalize_value(value).map_err(|e| e.to_string())
}
