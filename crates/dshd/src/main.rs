fn main() {
    let arg = std::env::args().nth(1);
    match arg.as_deref() {
        Some("--version") => println!("dshd 0.1.0"),
        _ => println!(
            "{{\"component\":\"dshd\",\"status\":\"NOT_IMPLEMENTED\",\"milestone\":\"M1\"}}"
        ),
    }
}
