use std::{fmt, str::FromStr};
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConfigError {
    Missing(&'static str),
    InvalidNodeId,
    InvalidEndpoint(&'static str),
    InvalidPort,
}
#[derive(Clone, Eq, PartialEq)]
pub struct Secret(String);
impl Secret {
    pub fn new(v: String) -> Result<Self, ConfigError> {
        if v.is_empty() {
            Err(ConfigError::Missing("node_token"))
        } else {
            Ok(Self(v))
        }
    }
    pub fn expose(&self) -> &str {
        &self.0
    }
}
impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Secret([REDACTED])")
    }
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Endpoint {
    pub scheme: String,
    pub authority: String,
}
impl Endpoint {
    pub fn parse(name: &'static str, raw: &str) -> Result<Self, ConfigError> {
        if raw.is_empty() {
            return Err(ConfigError::Missing(name));
        }
        let (scheme, rest) = raw
            .split_once("://")
            .ok_or(ConfigError::InvalidEndpoint(name))?;
        if !matches!(scheme, "http" | "https")
            || rest.is_empty()
            || rest.contains(['@', '/', '?', '#'])
        {
            return Err(ConfigError::InvalidEndpoint(name));
        }
        let (host, port) = rest
            .rsplit_once(':')
            .ok_or(ConfigError::InvalidEndpoint(name))?;
        if host.is_empty() || port.parse::<u16>().is_err() {
            return Err(ConfigError::InvalidEndpoint(name));
        }
        Ok(Self {
            scheme: scheme.into(),
            authority: rest.into(),
        })
    }
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidatedConfig {
    pub node_id: String,
    pub node_token: Secret,
    pub listen_port: u16,
    pub advertise: Endpoint,
    pub central: Endpoint,
}
impl ValidatedConfig {
    pub fn new(
        node_id: String,
        token: String,
        port: u32,
        advertise: &str,
        central: &str,
    ) -> Result<Self, ConfigError> {
        if !valid_uuid(&node_id) {
            return Err(ConfigError::InvalidNodeId);
        }
        let listen_port = u16::try_from(port)
            .ok()
            .filter(|p| *p >= 1024)
            .ok_or(ConfigError::InvalidPort)?;
        Ok(Self {
            node_id,
            node_token: Secret::new(token)?,
            listen_port,
            advertise: Endpoint::parse("advertise_url", advertise)?,
            central: Endpoint::parse("central_base_url", central)?,
        })
    }
}
pub fn valid_uuid(v: &str) -> bool {
    let b = v.as_bytes();
    b.len() == 36
        && [8, 13, 18, 23].iter().all(|i| b[*i] == b'-')
        && b.iter()
            .enumerate()
            .all(|(i, c)| [8, 13, 18, 23].contains(&i) || c.is_ascii_hexdigit())
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReadyUrl {
    pub authority: String,
    pub token: Secret,
}
impl ReadyUrl {
    pub fn parse(raw: &str) -> Result<Self, ConfigError> {
        if raw.len() > 4096 || raw.contains(['\r', '\n', '#', '@']) {
            return Err(ConfigError::InvalidEndpoint("ready_url"));
        }
        let rest = raw
            .strip_prefix("http://127.0.0.1:")
            .ok_or(ConfigError::InvalidEndpoint("ready_url"))?;
        let (port, token) = rest
            .split_once("/?token=")
            .ok_or(ConfigError::InvalidEndpoint("ready_url"))?;
        let port = u16::from_str(port).map_err(|_| ConfigError::InvalidEndpoint("ready_url"))?;
        if port == 0 || token.is_empty() || token.contains(['&', '?', '/']) {
            return Err(ConfigError::InvalidEndpoint("ready_url"));
        }
        Ok(Self {
            authority: format!("127.0.0.1:{port}"),
            token: Secret(token.into()),
        })
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    const ID: &str = "123e4567-e89b-42d3-a456-426614174000";
    #[test]
    fn config_rules() {
        assert!(
            ValidatedConfig::new(
                ID.into(),
                "s".into(),
                8080,
                "http://node:8080",
                "https://central:443"
            )
            .is_ok()
        );
        for bad in ["", "http://u@h:1", "http://h:1/x", "http://h:1?q"] {
            assert!(
                ValidatedConfig::new(ID.into(), "s".into(), 8080, bad, "https://c:443").is_err()
            );
        }
        assert!(
            ValidatedConfig::new(ID.into(), "s".into(), 80, "http://n:1", "http://c:1").is_err()
        );
    }
    #[test]
    fn exact_authority() {
        assert_eq!(
            ReadyUrl::parse("http://127.0.0.1:32123/?token=opaque")
                .unwrap()
                .authority,
            "127.0.0.1:32123"
        );
        assert!(ReadyUrl::parse("http://localhost:32123/?token=x").is_err());
    }
    #[test]
    fn redaction() {
        assert_eq!(
            format!("{:?}", Secret::new("sensitive".into()).unwrap()),
            "Secret([REDACTED])"
        );
    }
}
