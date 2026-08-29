use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
};
#[derive(Clone, Copy)]
struct Route {
    method: &'static str,
    path: &'static str,
    probe: &'static str,
}
const ROUTES: &[Route] = &[
    Route {
        method: "PUT",
        path: "/internal/dshd/v1/nodes/{node_id}/instances/{instance_id}",
        probe: "/internal/dshd/v1/nodes/n/instances/i",
    },
    Route {
        method: "PUT",
        path: "/internal/dshd/v1/nodes/{node_id}/instances/{instance_id}/lease",
        probe: "/internal/dshd/v1/nodes/n/instances/i/lease",
    },
    Route {
        method: "DELETE",
        path: "/internal/dshd/v1/nodes/{node_id}/instances/{instance_id}",
        probe: "/internal/dshd/v1/nodes/n/instances/i",
    },
    Route {
        method: "GET",
        path: "/daemon/v1/status",
        probe: "/daemon/v1/status",
    },
    Route {
        method: "GET",
        path: "/daemon/v1/health/live",
        probe: "/daemon/v1/health/live",
    },
    Route {
        method: "GET",
        path: "/daemon/v1/health/local",
        probe: "/daemon/v1/health/local",
    },
    Route {
        method: "GET",
        path: "/daemon/v1/health/ready",
        probe: "/daemon/v1/health/ready",
    },
    Route {
        method: "POST",
        path: "/daemon/v1/harness/start",
        probe: "/daemon/v1/harness/start",
    },
    Route {
        method: "POST",
        path: "/daemon/v1/harness/stop",
        probe: "/daemon/v1/harness/stop",
    },
    Route {
        method: "POST",
        path: "/daemon/v1/harness/restart",
        probe: "/daemon/v1/harness/restart",
    },
    Route {
        method: "GET",
        path: "/daemon/v1/operations/{operation_id}",
        probe: "/daemon/v1/operations/o",
    },
    Route {
        method: "ANY",
        path: "/api/**",
        probe: "/api/self-test",
    },
    Route {
        method: "GET",
        path: "/api/remote.mux",
        probe: "/api/remote.mux",
    },
];
fn matches(r: &Route, method: &str, path: &str) -> bool {
    if r.method != "ANY" && r.method != method {
        return false;
    }
    if r.path == "/api/**" {
        return path.starts_with("/api/") && path != "/api/remote.mux";
    }
    if r.path.contains('{') {
        let prefix = r.path.split('{').next().unwrap();
        return path.starts_with(prefix) && path.split('/').count() == r.probe.split('/').count();
    }
    r.path == path
}
fn serve(listener: TcpListener) {
    for _ in 0..ROUTES.len() {
        let (mut stream, _) = listener.accept().unwrap();
        let mut bytes = [0; 2048];
        let n = stream.read(&mut bytes).unwrap();
        let request = String::from_utf8_lossy(&bytes[..n]);
        let mut words = request.split_whitespace();
        let method = words.next().unwrap_or("");
        let path = words.next().unwrap_or("");
        let code = if ROUTES.iter().any(|r| matches(r, method, path)) {
            "200 OK"
        } else {
            "404 Not Found"
        };
        let body = "NOT_IMPLEMENTED";
        let response = format!(
            "HTTP/1.1 {code}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).unwrap();
        stream.shutdown(std::net::Shutdown::Write).unwrap();
    }
}
fn call(addr: std::net::SocketAddr, method: &str, path: &str) -> String {
    let mut stream = TcpStream::connect(addr).unwrap();
    write!(
        stream,
        "{method} {path} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    let mut out = String::new();
    // Windows may report WSAECONNRESET after all response bytes were read.
    let _ = stream.read_to_string(&mut out);
    out
}
fn self_test() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let server = thread::spawn(move || serve(listener));
    let mut passed = 0;
    for route in ROUTES {
        let response = call(
            addr,
            if route.method == "ANY" {
                "GET"
            } else {
                route.method
            },
            route.probe,
        );
        if response.starts_with("HTTP/1.1 200 OK") && response.ends_with("NOT_IMPLEMENTED") {
            passed += 1
        } else {
            eprintln!(
                "SELF_TEST=FAIL route={} {} response={response:?}",
                route.method, route.path
            );
            std::process::exit(1)
        }
    }
    server.join().unwrap();
    println!(
        "SELF_TEST=PASS registry=http://{addr} client=register,heartbeat,deregister route_probe={passed}/{} PASS behavior=NOT_IMPLEMENTED vectors_executed=0",
        ROUTES.len()
    )
}
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("reference-stub 0.3.0"),
        Some("--self-test") => self_test(),
        _ => println!(
            "NOT_IMPLEMENTED reference stub skeleton routes={}",
            ROUTES.len()
        ),
    }
}
