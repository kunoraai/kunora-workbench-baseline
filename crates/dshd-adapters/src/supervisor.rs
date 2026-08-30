use dshd_core::{
    config::ReadyUrl,
    state::{AttemptId, Effect, Event},
};
use std::{
    collections::BTreeMap,
    io::{self, BufRead, BufReader, Read},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, mpsc::SyncSender},
    thread,
    time::{Duration, Instant},
};

#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::harness::exchange_and_probe;

/// Frozen real-Harness launch profile (T14): `dsh web --no-open --port 0`.
pub const FROZEN_HARNESS_PROFILE: &str = "dsh web --no-open --port 0";
#[derive(Clone, Debug)]
pub struct ProcessSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: Vec<(String, String)>,
}
pub fn harness_spec(program: PathBuf, entries: Vec<PathBuf>, cwd: PathBuf) -> ProcessSpec {
    let mut args = Vec::new();
    for entry in entries {
        args.push(entry.to_string_lossy().into_owned());
    }
    args.extend([
        "web".into(),
        "--no-open".into(),
        "--port".into(),
        "0".into(),
    ]);
    ProcessSpec {
        program,
        args,
        cwd,
        env: vec![("DSH_TELEMETRY_DISABLED".into(), "1".into())],
    }
}

struct ManagedChild {
    child: Arc<Mutex<Child>>,
}

#[derive(Clone)]
pub struct Supervisor {
    spec: ProcessSpec,
    backoff: BackoffPolicy,
    children: Arc<Mutex<BTreeMap<AttemptId, ManagedChild>>>,
    ready: Arc<Mutex<BTreeMap<AttemptId, ReadyUrl>>>,
    stop_timeout: Duration,
}

impl Supervisor {
    pub fn new(spec: ProcessSpec, backoff: BackoffPolicy) -> Self {
        Self {
            spec,
            backoff,
            children: Arc::new(Mutex::new(BTreeMap::new())),
            ready: Arc::new(Mutex::new(BTreeMap::new())),
            stop_timeout: Duration::from_secs(8),
        }
    }

    pub fn with_stop_timeout(mut self, stop_timeout: Duration) -> Self {
        self.stop_timeout = stop_timeout;
        self
    }

    pub fn execute(&self, effect: Effect, feedback: SyncSender<Event>) {
        match effect {
            Effect::Spawn(attempt) => self.spawn_attempt(attempt, feedback),
            Effect::Bootstrap(attempt) => self.bootstrap(attempt, feedback),
            Effect::ScheduleBackoff(attempt) => {
                let delay = self.backoff.delay(attempt.0.saturating_sub(1) as u32);
                println!(
                    "{{\"component\":\"dshd\",\"effect\":\"ScheduleBackoff\",\"attempt\":{},\"delay_ms\":{}}}",
                    attempt.0,
                    delay.as_millis()
                );
                thread::spawn(move || {
                    thread::sleep(delay);
                    let _ = feedback.send(Event::BackoffElapsed(attempt));
                });
            }
            Effect::Stop(attempt) => {
                let supervisor = self.clone();
                thread::spawn(move || supervisor.stop(attempt, feedback));
            }
            Effect::PersistDesired(_) | Effect::PublishContext(_) | Effect::DropContext => {}
        }
    }

    fn spawn_attempt(&self, attempt: AttemptId, feedback: SyncSender<Event>) {
        let mut child = match spawn(&self.spec) {
            Ok(child) => child,
            Err(error) => {
                let _ = feedback.send(Event::Failed(attempt, format!("spawn: {error}")));
                return;
            }
        };
        let pid = child.id();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let child = Arc::new(Mutex::new(child));
        self.children.lock().expect("children poisoned").insert(
            attempt,
            ManagedChild {
                child: Arc::clone(&child),
            },
        );
        println!(
            "{{\"component\":\"dshd\",\"effect\":\"Spawn\",\"attempt\":{},\"child_pid\":{},\"profile\":\"{}\"}}",
            attempt.0, pid, FROZEN_HARNESS_PROFILE
        );
        let _ = feedback.send(Event::Spawned(attempt));

        if let Some(mut stdout) = stdout {
            let ready = Arc::clone(&self.ready);
            let ready_feedback = feedback.clone();
            thread::spawn(move || {
                let mut output = String::new();
                let mut chunk = [0_u8; 1024];
                while let Ok(count) = stdout.read(&mut chunk) {
                    if count == 0 {
                        break;
                    }
                    output.push_str(&String::from_utf8_lossy(&chunk[..count]));
                    if output.len() > 100_000 {
                        output.drain(..output.len() - 100_000);
                    }
                    let Some(raw) = output
                        .split_once("dsh web: ")
                        .map(|(_, rest)| rest.split_whitespace().next().unwrap_or(""))
                    else {
                        continue;
                    };
                    match ReadyUrl::parse(raw) {
                        Ok(url) => {
                            println!(
                                "{{\"component\":\"dshd\",\"event\":\"ready-url\",\"attempt\":{},\"child_pid\":{},\"authority\":\"{}\",\"token\":\"REDACTED\"}}",
                                attempt.0, pid, url.authority
                            );
                            ready.lock().expect("ready poisoned").insert(attempt, url);
                            let _ = ready_feedback.send(Event::ReadyUrl(attempt));
                            break;
                        }
                        Err(_) => {
                            let _ = ready_feedback
                                .send(Event::Failed(attempt, "invalid ready URL".into()));
                            break;
                        }
                    }
                }
            });
        }
        if let Some(stderr) = stderr {
            thread::spawn(move || {
                let mut retained = 0_usize;
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    if retained >= 4096 {
                        break;
                    }
                    let safe = crate::observability::redact(&line);
                    retained += safe.len();
                    if !safe.trim().is_empty() {
                        eprintln!("{{\"component\":\"dshd\",\"child_stderr\":{safe:?}}}");
                    }
                }
            });
        }
        thread::spawn(move || {
            loop {
                let exited = child.lock().expect("child poisoned").try_wait();
                match exited {
                    Ok(Some(_)) => {
                        println!(
                            "{{\"component\":\"dshd\",\"event\":\"child-exited\",\"attempt\":{},\"child_pid\":{}}}",
                            attempt.0, pid
                        );
                        let _ = feedback.send(Event::ChildExited(attempt));
                        break;
                    }
                    Ok(None) => thread::sleep(Duration::from_millis(50)),
                    Err(error) => {
                        let _ = feedback.send(Event::Failed(attempt, format!("wait: {error}")));
                        break;
                    }
                }
            }
        });
    }

    fn bootstrap(&self, attempt: AttemptId, feedback: SyncSender<Event>) {
        let ready = self
            .ready
            .lock()
            .expect("ready poisoned")
            .get(&attempt)
            .cloned();
        thread::spawn(move || match ready {
            Some(url) => match exchange_and_probe(&url) {
                Ok(result) => {
                    println!(
                        "{{\"component\":\"dshd\",\"effect\":\"Bootstrap\",\"attempt\":{},\"authority\":\"{}\",\"exchange\":303,\"probe\":\"HTTP_200\",\"cookie\":\"REDACTED\"}}",
                        attempt.0, result.authority
                    );
                    let _ = feedback.send(Event::BootstrapSucceeded(
                        attempt,
                        result.authority,
                        result.cookie,
                    ));
                }
                Err(error) => {
                    let _ = feedback.send(Event::Failed(attempt, format!("bootstrap: {error}")));
                }
            },
            None => {
                let _ = feedback.send(Event::Failed(attempt, "ready URL missing".into()));
            }
        });
    }

    fn stop(&self, attempt: AttemptId, feedback: SyncSender<Event>) {
        if let Some(managed) = self
            .children
            .lock()
            .expect("children poisoned")
            .remove(&attempt)
        {
            let pid = managed.child.lock().expect("child poisoned").id();
            println!(
                "{{\"component\":\"dshd\",\"effect\":\"Stop\",\"attempt\":{},\"phase\":\"graceful-terminate\",\"stop_timeout_ms\":{}}}",
                attempt.0,
                self.stop_timeout.as_millis()
            );
            let deadline = Instant::now() + self.stop_timeout;
            #[cfg(windows)]
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
            #[cfg(unix)]
            let _ = Command::new("kill")
                .args(["-TERM", &format!("-{pid}")])
                .status();
            while Instant::now() < deadline {
                match managed.child.lock().expect("child poisoned").try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => thread::sleep(Duration::from_millis(20)),
                    Err(_) => break,
                }
            }
            if managed
                .child
                .lock()
                .expect("child poisoned")
                .try_wait()
                .ok()
                .flatten()
                .is_none()
            {
                println!(
                    "{{\"component\":\"dshd\",\"effect\":\"Stop\",\"attempt\":{},\"phase\":\"timeout-force-kill\"}}",
                    attempt.0
                );
                #[cfg(windows)]
                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/T", "/F"])
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
                #[cfg(unix)]
                let _ = Command::new("kill")
                    .args(["-KILL", &format!("-{pid}")])
                    .status();
                let _ = managed.child.lock().expect("child poisoned").kill();
            }
            let _ = managed.child.lock().expect("child poisoned").wait();
        }
        let _ = feedback.send(Event::Stopped(attempt));
    }
}
pub fn spawn(spec: &ProcessSpec) -> io::Result<Child> {
    let mut command = Command::new(&spec.program);
    command.args(&spec.args).current_dir(&spec.cwd);
    #[cfg(unix)]
    command.process_group(0);
    #[cfg(windows)]
    command.creation_flags(0x0000_0200); // CREATE_NEW_PROCESS_GROUP
    for (name, _) in std::env::vars() {
        let upper = name.to_ascii_uppercase();
        if ["KEY", "SECRET", "TOKEN", "PASSWORD"]
            .iter()
            .any(|sensitive| upper.contains(sensitive))
        {
            command.env_remove(name);
        }
    }
    command
        .envs(spec.env.iter().cloned())
        .stdin(Stdio::null())
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
            harness_spec("dsh".into(), Vec::new(), ".".into())
                .args
                .join(" "),
            "web --no-open --port 0"
        );
    }
    #[test]
    fn stop_timeout_is_injectable() {
        let supervisor = Supervisor::new(
            harness_spec("dsh".into(), Vec::new(), ".".into()),
            BackoffPolicy {
                initial: Duration::from_secs(1),
                maximum: Duration::from_secs(30),
            },
        )
        .with_stop_timeout(Duration::from_millis(25));
        assert_eq!(supervisor.stop_timeout, Duration::from_millis(25));
    }
}
