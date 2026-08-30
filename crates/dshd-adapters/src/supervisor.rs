use std::{
    io,
    path::PathBuf,
    process::{Child, Command, Stdio},
    time::Duration,
};

/// Frozen real-Harness launch profile (T14): `dsh web --no-open --port 0`.
pub const FROZEN_HARNESS_PROFILE: &str = "dsh web --no-open --port 0";
#[derive(Clone, Debug)]
pub struct ProcessSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: Vec<(String, String)>,
}
pub fn harness_spec(program: PathBuf, cwd: PathBuf) -> ProcessSpec {
    ProcessSpec {
        program,
        args: vec![
            "web".into(),
            "--no-open".into(),
            "--port".into(),
            "0".into(),
        ],
        cwd,
        env: vec![
            ("DSH_TELEMETRY_MODE".into(), "DISABLED".into()),
            ("DSH_TELEMETRY_DISABLED".into(), "1".into()),
        ],
    }
}
pub fn spawn(spec: &ProcessSpec) -> io::Result<Child> {
    Command::new(&spec.program)
        .args(&spec.args)
        .current_dir(&spec.cwd)
        .env_clear()
        .envs(spec.env.iter().cloned())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}
#[derive(Clone, Debug)]
pub struct BackoffPolicy {
    pub initial: Duration,
    pub maximum: Duration,
}
impl BackoffPolicy {
    pub fn delay(&self, failures: u32) -> Duration {
        self.initial
            .saturating_mul(2u32.saturating_pow(failures.min(30)))
            .min(self.maximum)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_backoff() {
        let p = BackoffPolicy {
            initial: Duration::from_secs(1),
            maximum: Duration::from_secs(30),
        };
        assert_eq!(p.delay(0), Duration::from_secs(1));
        assert_eq!(p.delay(9), Duration::from_secs(30));
    }
    #[test]
    fn fixed_profile() {
        assert_eq!(
            harness_spec("dsh".into(), ".".into()).args.join(" "),
            "web --no-open --port 0"
        );
    }
}
