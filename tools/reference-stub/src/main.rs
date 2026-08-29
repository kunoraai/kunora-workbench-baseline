const ROUTES: &[&str] = &[
    "register",
    "heartbeat",
    "deregister",
    "status",
    "live",
    "local",
    "ready",
    "start",
    "stop",
    "restart",
    "operation",
    "/api/**",
    "/api/remote.mux",
];
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("reference-stub 0.1.0"),
        Some("--self-test") => {
            assert_eq!(ROUTES.len(), 13);
            println!("SELF_TEST=PASS routes=13 behavior=NOT_IMPLEMENTED vectors_executed=0");
        }
        _ => println!("NOT_IMPLEMENTED reference stub skeleton"),
    }
}
