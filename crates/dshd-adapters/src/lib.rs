//! M2 operating-system adapters. Domain decisions remain in `dshd-core`.
pub mod coordinator;
pub mod files;
pub mod harness;
pub mod supervisor;
pub mod central {
    pub const STATUS: &str = "NOT_IMPLEMENTED_M6";
}
pub mod proxy {
    pub const STATUS: &str = "NOT_IMPLEMENTED_M4_M5";
}
pub mod transport {
    pub const STATUS: &str = "NOT_IMPLEMENTED_M3";
}
pub mod observability {
    pub fn redact(line: &str) -> String {
        if line.contains("token=") || line.to_ascii_lowercase().contains("set-cookie:") {
            "[REDACTED]".into()
        } else {
            line.into()
        }
    }
}
