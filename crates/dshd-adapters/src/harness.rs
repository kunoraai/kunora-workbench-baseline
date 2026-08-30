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
fn request(authority: &str, path: &str, cookie: Option<&Secret>) -> io::Result<String> {
    let mut s = TcpStream::connect(authority)?;
    s.set_read_timeout(Some(Duration::from_secs(5)))?;
    write!(s, "GET {path} HTTP/1.1\r\nHost: {authority}\r\n")?;
    if let Some(c) = cookie {
        write!(s, "Cookie: {}\r\n", c.expose())?;
    }
    write!(s, "Connection: close\r\n\r\n")?;
    let mut out = String::new();
    s.read_to_string(&mut out)?;
    Ok(out)
}
pub fn exchange_and_probe(ready: &ReadyUrl) -> io::Result<BootstrapResult> {
    let auth = request(
        &ready.authority,
        &format!("/?token={}", ready.token.expose()),
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
        .find_map(|l| l.strip_prefix("Set-Cookie: "))
        .and_then(|v| v.split(';').next())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "cookie missing"))?;
    let cookie = Secret::new(raw.into())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "cookie invalid"))?;
    let probe = request(&ready.authority, "/api/probe", Some(&cookie))?;
    if !probe.starts_with("HTTP/1.1 200") {
        return Err(io::Error::other("probe failed"));
    }
    Ok(BootstrapResult {
        authority: ready.authority.clone(),
        cookie,
    })
}
