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

fn message_complete(bytes: &[u8]) -> io::Result<bool> {
    let Some(header_end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") else {
        return Ok(false);
    };
    let headers = std::str::from_utf8(&bytes[..header_end])
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    if headers.starts_with("HTTP/1.1 204 ") {
        return Ok(true);
    }
    let length = headers
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
    Ok(bytes.len() >= header_end + 4 + length)
}

fn request_once(addr: SocketAddr, request: &str) -> io::Result<String> {
    let mut stream = TcpStream::connect_timeout(&addr, IO_TIMEOUT)?;
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    stream.write_all(request.as_bytes())?;
    stream.shutdown(Shutdown::Write)?;
    let mut bytes = Vec::new();
    let mut chunk = [0; 2048];
    while !message_complete(&bytes)? {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "connection closed before HTTP response completed",
            ));
        }
        bytes.extend_from_slice(&chunk[..count]);
    }
    String::from_utf8(bytes).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

fn request(addr: SocketAddr, request: &str) -> io::Result<String> {
    for attempt in 1..=MAX_ATTEMPTS {
        match request_once(addr, request) {
            Ok(response) => return Ok(response),
            Err(error) if transient(&error) && attempt < MAX_ATTEMPTS => {
                thread::sleep(RETRY_DELAY * attempt as u32);
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!("bounded attempt loop always returns")
}

fn handle_connection(mut stream: TcpStream) -> io::Result<()> {
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    let mut bytes = [0; 2048];
    let count = stream.read(&mut bytes)?;
    if count == 0 {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "empty HTTP request",
        ));
    }
    let request = String::from_utf8_lossy(&bytes[..count]);
    let authorized =
        request.contains("Host: 127.0.0.1:") && request.contains("Cookie: dshd=authority-bound");
    let response = if request.starts_with("POST /auth?token=launch-token ") {
        "HTTP/1.1 204 No Content\r\nSet-Cookie: dshd=authority-bound; HttpOnly\r\nConnection: close\r\n\r\n"
    } else if request.starts_with("GET /api/remote.mux ") {
        "HTTP/1.1 501 Not Implemented\r\nConnection: close\r\nContent-Length: 15\r\n\r\nNOT_IMPLEMENTED"
    } else if request.starts_with("GET /api/probe ") && authorized {
        "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: 2\r\n\r\nOK"
    } else {
        "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 8\r\n\r\nREJECTED"
    };
    stream.write_all(response.as_bytes())?;
    stream.shutdown(Shutdown::Write)
}

fn serve(listener: TcpListener, done: Receiver<()>) -> io::Result<()> {
    listener.set_nonblocking(true)?;
    let mut consecutive_failures = 0;
    loop {
        match done.try_recv() {
            Ok(()) => return Ok(()),
            Err(TryRecvError::Disconnected) => {
                return Err(io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "completion channel disconnected",
                ));
            }
            Err(TryRecvError::Empty) => {}
        }
        match listener.accept() {
            Ok((stream, _)) => match handle_connection(stream) {
                Ok(()) => consecutive_failures = 0,
                Err(error) if transient(&error) && consecutive_failures + 1 < MAX_ATTEMPTS => {
                    consecutive_failures += 1;
                }
                Err(error) => return Err(error),
            },
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(5));
            }
            Err(error) if transient(&error) && consecutive_failures + 1 < MAX_ATTEMPTS => {
                consecutive_failures += 1;
                thread::sleep(RETRY_DELAY);
            }
            Err(error) => return Err(error),
        }
    }
}

fn self_test() -> Result<(), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let addr = listener.local_addr().map_err(|error| error.to_string())?;
    let (done_tx, done_rx) = mpsc::channel();
    let server = thread::spawn(move || serve(listener, done_rx));
    let host = addr.to_string();
    let checks = (|| {
        let auth = request(addr, &format!("POST /auth?token=launch-token HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n")).map_err(|error| error.to_string())?;
        if !(auth.contains("204") && auth.contains("authority-bound")) {
            return Err(format!("authentication response mismatch: {auth:?}"));
        }
        let probe = request(addr, &format!("GET /api/probe HTTP/1.1\r\nHost: {host}\r\nCookie: dshd=authority-bound\r\nConnection: close\r\n\r\n")).map_err(|error| error.to_string())?;
        if !probe.contains("200 OK") {
            return Err(format!("authorized probe response mismatch: {probe:?}"));
        }
        let reject = request(addr, &format!("GET /api/probe HTTP/1.1\r\nHost: {host}\r\nCookie: bad\r\nConnection: close\r\n\r\n")).map_err(|error| error.to_string())?;
        if !reject.contains("401") {
            return Err(format!("rejected probe response mismatch: {reject:?}"));
        }
        Ok(())
    })();
    done_tx.send(()).map_err(|error| error.to_string())?;
    server
        .join()
        .map_err(|_| "fake Harness server thread panicked".to_owned())?
        .map_err(|error| error.to_string())?;
    checks?;
    if "http://bad host/?token=x"
        .parse::<std::net::IpAddr>()
        .is_ok()
    {
        return Err("malformed URL fixture was accepted".to_owned());
    }
    println!(
        "SELF_TEST=PASS ready=loopback-authority probe=HTTP_OK cookie=authority-bound fixtures=ready-fragmented,ready-delayed,malformed-url,token-rejected,probe-failed,crash-immediate,crash-delayed,hang seed=2 vectors_executed=0 host={host}"
    );
    Ok(())
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("fake-harness 0.2.0"),
        Some("--self-test") => {
            if let Err(error) = self_test() {
                eprintln!("SELF_TEST=FAIL {error}");
                std::process::exit(1);
            }
        }
        _ => println!("NOT_IMPLEMENTED fake Harness skeleton"),
    }
}
