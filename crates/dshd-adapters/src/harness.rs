use dshd_core::config::{ReadyUrl, Secret};
use std::{
    io::{self, Read, Write},
    net::TcpStream,
    time::Duration,
};
#[derive(Debug)]
pub struct BootstrapResult {
    pub authority: String,
    pub cookie: Secret,
}
fn request(
    authority: &str,
    path: &str,
    cookie: Option<&Secret>,
    body: Option<&str>,
) -> io::Result<String> {
    let mut s = TcpStream::connect(authority)?;
    s.set_read_timeout(Some(Duration::from_secs(5)))?;
    if let Some(body) = body {
        write!(
            s,
            "POST {path} HTTP/1.1\r\nHost: {authority}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n",
            body.len()
        )?;
    } else {
        write!(s, "GET {path} HTTP/1.1\r\nHost: {authority}\r\n")?;
    }
    if let Some(c) = cookie {
        write!(s, "Cookie: {}\r\n", c.expose())?;
    }
    write!(s, "Connection: close\r\n\r\n{}", body.unwrap_or(""))?;
    let mut out = String::new();
    s.read_to_string(&mut out)?;
    Ok(out)
}
pub fn exchange_and_probe(ready: &ReadyUrl) -> io::Result<BootstrapResult> {
    let auth = request(
        &ready.authority,
        &format!("/?token={}", ready.token.expose()),
        None,
        None,
    )?;
    if !auth.starts_with("HTTP/1.1 303") && !auth.starts_with("HTTP/1.1 204") {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "token exchange rejected",
        ));
    }
    let raw = auth
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("set-cookie")
                .then_some(value.trim())
        })
        .and_then(|v| v.split(';').next())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "cookie missing"))?;
    let cookie = Secret::new(raw.into())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "cookie invalid"))?;
    let body = r#"{"type":"client-request","rpcId":"dshd-m2-probe","method":"settings/describe","payload":{"args":{}}}"#;
    let probe = request(
        &ready.authority,
        "/api/settings/describe",
        Some(&cookie),
        Some(body),
    )?;
    if !probe.starts_with("HTTP/1.1 200") || !probe.contains("server-response") {
        return Err(io::Error::other("probe failed"));
    }
    Ok(BootstrapResult {
        authority: ready.authority.clone(),
        cookie,
    })
}
