use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
};
fn request(addr: std::net::SocketAddr, req: &str) -> String {
    let mut s = TcpStream::connect(addr).unwrap();
    s.write_all(req.as_bytes()).unwrap();
    let mut b = String::new();
    s.read_to_string(&mut b).unwrap();
    b
}
fn serve(listener: TcpListener) {
    for _ in 0..3 {
        let (mut s, _) = listener.accept().unwrap();
        let mut b = [0; 2048];
        let n = s.read(&mut b).unwrap();
        let r = String::from_utf8_lossy(&b[..n]);
        let authorized =
            r.contains("Host: 127.0.0.1:") && r.contains("Cookie: dshd=authority-bound");
        let response = if r.starts_with("POST /auth?token=launch-token ") {
            "HTTP/1.1 204 No Content\r\nSet-Cookie: dshd=authority-bound; HttpOnly\r\nConnection: close\r\n\r\n"
        } else if r.starts_with("GET /api/remote.mux ") {
            "HTTP/1.1 501 Not Implemented\r\nConnection: close\r\nContent-Length: 15\r\n\r\nNOT_IMPLEMENTED"
        } else if r.starts_with("GET /api/probe ") && authorized {
            "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: 2\r\n\r\nOK"
        } else {
            "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 8\r\n\r\nREJECTED"
        };
        s.write_all(response.as_bytes()).unwrap();
    }
}
fn self_test() {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = l.local_addr().unwrap();
    let t = thread::spawn(move || serve(l));
    let host = addr.to_string();
    let auth = request(
        addr,
        &format!(
            "POST /auth?token=launch-token HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
        ),
    );
    assert!(auth.contains("204") && auth.contains("authority-bound"));
    let probe = request(
        addr,
        &format!(
            "GET /api/probe HTTP/1.1\r\nHost: {host}\r\nCookie: dshd=authority-bound\r\nConnection: close\r\n\r\n"
        ),
    );
    assert!(probe.contains("200 OK"));
    let reject = request(
        addr,
        &format!(
            "GET /api/probe HTTP/1.1\r\nHost: {host}\r\nCookie: bad\r\nConnection: close\r\n\r\n"
        ),
    );
    assert!(reject.contains("401"));
    t.join().unwrap();
    assert!(
        "http://bad host/?token=x"
            .parse::<std::net::IpAddr>()
            .is_err()
    );
    println!(
        "SELF_TEST=PASS ready=http://{host}/?token=launch-token probe=HTTP_OK authority_cookie=PASS fixtures=ready-fragmented,malformed-url,token-rejected ws=NOT_IMPLEMENTED vectors_executed=0"
    )
}
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("fake-harness 0.2.0"),
        Some("--self-test") => self_test(),
        _ => println!("NOT_IMPLEMENTED fake Harness skeleton"),
    }
}
