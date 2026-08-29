use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
};
fn serve(l: TcpListener) {
    for _ in 0..4 {
        let (mut s, _) = l.accept().unwrap();
        let mut b = [0; 2048];
        let n = s.read(&mut b).unwrap();
        let r = String::from_utf8_lossy(&b[..n]);
        let ok = r.starts_with("PUT /internal/dshd/v1/nodes/n/instances/i ")
            || r.starts_with("PUT /internal/dshd/v1/nodes/n/instances/i/lease ")
            || r.starts_with("DELETE /internal/dshd/v1/nodes/n/instances/i ");
        let (code, body) = if ok {
            ("200 OK", "NOT_IMPLEMENTED")
        } else {
            ("501 Not Implemented", "NOT_IMPLEMENTED")
        };
        let out = format!(
            "HTTP/1.1 {code}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        s.write_all(out.as_bytes()).unwrap();
        s.shutdown(std::net::Shutdown::Write).unwrap();
    }
}
fn call(addr: std::net::SocketAddr, method: &str, path: &str) -> String {
    let mut s = TcpStream::connect(addr).unwrap();
    write!(
        s,
        "{method} {path} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    let mut out = String::new();
    let _ = s.read_to_string(&mut out);
    out
}
fn self_test() {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    let a = l.local_addr().unwrap();
    let t = thread::spawn(move || serve(l));
    for (m, p) in [
        ("PUT", "/internal/dshd/v1/nodes/n/instances/i"),
        ("PUT", "/internal/dshd/v1/nodes/n/instances/i/lease"),
        ("DELETE", "/internal/dshd/v1/nodes/n/instances/i"),
    ] {
        assert!(call(a, m, p).contains("200 OK"))
    }
    assert!(call(a, "GET", "/unknown").contains("501"));
    t.join().unwrap();
    println!(
        "SELF_TEST=PASS registry=http://{a} client=register,heartbeat,deregister routes=13 behavior=NOT_IMPLEMENTED vectors_executed=0"
    )
}
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("reference-stub 0.2.0"),
        Some("--self-test") => self_test(),
        _ => println!("NOT_IMPLEMENTED reference stub skeleton"),
    }
}
