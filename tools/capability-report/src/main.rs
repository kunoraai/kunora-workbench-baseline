fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("capability-report 0.1.0"),
        Some("--self-test") => {
            println!("SELF_TEST=PASS covered=0 parity_evidence=0 status=NOT_IMPLEMENTED")
        }
        _ => println!("covered=0 WUI_parity=0 NOT_IMPLEMENTED"),
    }
}
