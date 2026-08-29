const SCENARIOS: &[&str] = &[
    "ready-fragmented",
    "ready-delayed",
    "ready-malformed",
    "token-rejected",
    "authority-mismatch",
    "probe-failed",
    "process-exit",
    "http-slow-body",
    "http-chunked",
    "http-pre-commit-abort",
    "http-post-commit-abort",
    "http-backpressure",
    "ws-upgrade-failed",
    "ws-subprotocol-mismatch",
    "ws-frames",
    "ws-half-close",
];
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("fake-harness 0.1.0"),
        Some("--self-test") => {
            assert_eq!(SCENARIOS.len(), 16);
            println!("SELF_TEST=PASS scenarios=16 vectors_executed=0");
        }
        _ => println!("NOT_IMPLEMENTED fake Harness skeleton"),
    }
}
