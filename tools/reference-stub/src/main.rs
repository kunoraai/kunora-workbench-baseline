use std::{
    io::{self, Read, Write},
    net::{Shutdown, SocketAddr, TcpListener, TcpStream},
    sync::mpsc::{self, Receiver, TryRecvError},
    thread,
    time::Duration,
};

const MAX_ATTEMPTS: usize = 3;
const RETRY_DELAY: Duration = Duration::from_millis(25);
const IO_TIMEOUT: Duration = Duration::from_secs(2);
const MAX_MESSAGE_BYTES: usize = 16 * 1024;

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

fn matches(route: &Route, method: &str, path: &str) -> bool {
    if route.method != "ANY" && route.method != method {
        return false;
    }
    if route.path == "/api/**" {
        return path.starts_with("/api/") && path != "/api/remote.mux";
    }
    if route.path.contains('{') {
        let prefix = route.path.split('{').next().unwrap_or(route.path);
        return path.starts_with(prefix)
            && path.split('/').count() == route.probe.split('/').count();
    }
    route.path == path
}

fn transient(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::ConnectionAborted
            | io::ErrorKind::ConnectionRefused
            | io::ErrorKind::ConnectionReset
            | io::ErrorKind::Interrupted
            | io::ErrorKind::TimedOut
            | io::ErrorKind::WouldBlock
    ) || matches!(error.raw_os_error(), Some(10004 | 10053 | 10054 | 10061))
}

fn read_headers(stream: &mut TcpStream) -> io::Result<Vec<u8>> {
    let mut message = Vec::new();
    let mut chunk = [0; 2048];
    while !message.windows(4).any(|window| window == b"\r\n\r\n") {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "connection closed before HTTP headers completed",
            ));
        }
        message.extend_from_slice(&chunk[..count]);
        if message.len() > MAX_MESSAGE_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "HTTP message exceeded self-test limit",
            ));
        }
    }
    Ok(message)
}

fn handle_connection(mut stream: TcpStream) -> io::Result<()> {
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    let bytes = read_headers(&mut stream)?;
    let request = String::from_utf8_lossy(&bytes);
    let mut words = request.split_whitespace();
    let method = words.next().unwrap_or("");
    let path = words.next().unwrap_or("");
    let code = if ROUTES.iter().any(|route| matches(route, method, path)) {
        "200 OK"
    } else {
        "404 Not Found"
    };
    let body = "NOT_IMPLEMENTED";
    let response = format!(
        "HTTP/1.1 {code}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())?;
    stream.shutdown(Shutdown::Write)
}

fn serve(listener: TcpListener, done: Receiver<()>) -> io::Result<()> {
    listener.set_nonblocking(true)?;
    let mut consecutive_transient_failures = 0;
    loop {
        match done.try_recv() {
            Ok(()) => return Ok(()),
            Err(TryRecvError::Disconnected) => {
                return Err(io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "self-test completion channel disconnected",
                ));
            }
            Err(TryRecvError::Empty) => {}
        }
        match listener.accept() {
            Ok((stream, _)) => match handle_connection(stream) {
                Ok(()) => consecutive_transient_failures = 0,
                Err(error) if transient(&error) => {
                    consecutive_transient_failures += 1;
                    if consecutive_transient_failures >= MAX_ATTEMPTS {
                        return Err(error);
                    }
                }
                Err(error) => return Err(error),
            },
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(5))
            }
            Err(error) if transient(&error) => {
                consecutive_transient_failures += 1;
                if consecutive_transient_failures >= MAX_ATTEMPTS {
                    return Err(error);
                }
                thread::sleep(RETRY_DELAY);
            }
            Err(error) => return Err(error),
        }
    }
}

fn response_complete(bytes: &[u8]) -> io::Result<bool> {
    let Some(header_end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") else {
        return Ok(false);
    };
    let headers = std::str::from_utf8(&bytes[..header_end])
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let content_length = headers
        .lines()
        .find_map(|line| {
            line.split_once(':').and_then(|(name, value)| {
                name.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>())
            })
        })
        .transpose()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing Content-Length"))?;
    Ok(bytes.len() >= header_end + 4 + content_length)
}

fn call_once(addr: SocketAddr, method: &str, path: &str) -> io::Result<String> {
    let mut stream = TcpStream::connect_timeout(&addr, IO_TIMEOUT)?;
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    write!(
        stream,
        "{method} {path} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n"
    )?;
    stream.shutdown(Shutdown::Write)?;
    let mut response = Vec::new();
    let mut chunk = [0; 2048];
    while !response_complete(&response)? {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "connection closed before HTTP response completed",
            ));
        }
        response.extend_from_slice(&chunk[..count]);
        if response.len() > MAX_MESSAGE_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "HTTP response exceeded self-test limit",
            ));
        }
    }
    String::from_utf8(response).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

fn call(addr: SocketAddr, method: &str, path: &str) -> io::Result<String> {
    for attempt in 1..=MAX_ATTEMPTS {
        match call_once(addr, method, path) {
            Ok(response) => return Ok(response),
            Err(error) if transient(&error) && attempt < MAX_ATTEMPTS => {
                thread::sleep(RETRY_DELAY * attempt as u32)
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!("bounded attempt loop always returns")
}

fn self_test() -> Result<(), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let addr = listener.local_addr().map_err(|error| error.to_string())?;
    let (done_tx, done_rx) = mpsc::channel();
    let server = thread::spawn(move || serve(listener, done_rx));
    let probe_result = (|| {
        let mut passed = 0;
        for route in ROUTES {
            let method = if route.method == "ANY" {
                "GET"
            } else {
                route.method
            };
            let response = call(addr, method, route.probe).map_err(|error| {
                format!(
                    "route={} {} exhausted after {MAX_ATTEMPTS} attempts: {error}",
                    route.method, route.path
                )
            })?;
            if response.starts_with("HTTP/1.1 200 OK") && response.ends_with("NOT_IMPLEMENTED") {
                passed += 1;
            } else {
                return Err(format!(
                    "route={} {} response={response:?}",
                    route.method, route.path
                ));
            }
        }
        Ok(passed)
    })();
    done_tx
        .send(())
        .map_err(|error| format!("failed to signal self-test server: {error}"))?;
    let server_result = server
        .join()
        .map_err(|_| "self-test server thread panicked".to_owned())?;
    server_result.map_err(|error| format!("self-test server failed: {error}"))?;
    let passed = probe_result?;
    println!(
        "SELF_TEST=PASS registry=http://{addr} client=register,heartbeat,deregister route_probe={passed}/{} PASS behavior=NOT_IMPLEMENTED vectors_executed=0",
        ROUTES.len()
    );
    Ok(())
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("reference-stub 0.3.0"),
        Some("--self-test") => {
            if let Err(error) = self_test() {
                eprintln!("SELF_TEST=FAIL {error}");
                std::process::exit(1);
            }
        }
        _ => println!(
            "NOT_IMPLEMENTED reference stub skeleton routes={}",
            ROUTES.len()
        ),
    }
}
