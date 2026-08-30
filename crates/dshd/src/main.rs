use dshd_adapters::{
    coordinator::Coordinator,
    files::{DesiredStore, IdentityStore, WriterGuard, generated_uuid_v4},
    supervisor::{BackoffPolicy, Supervisor, harness_spec},
};
use dshd_core::{
    config::ValidatedConfig,
    identity::{IdentityDecision, decide},
    state::{Event, Snapshot},
};
use std::{
    io::{self, BufRead},
    path::PathBuf,
    process::ExitCode,
    thread,
    time::{Duration, Instant},
};

fn value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}
fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--version") {
        println!("dshd 0.2.0");
        return Ok(());
    }
    let root = PathBuf::from(value(&args, "--state-dir").ok_or("CONFIG_MISSING state-dir")?);
    let config = ValidatedConfig::new(
        value(&args, "--node-id").ok_or("CONFIG_MISSING node-id")?,
        value(&args, "--node-token").ok_or("CONFIG_MISSING node-token")?,
        value(&args, "--listen-port")
            .unwrap_or_else(|| "8080".into())
            .parse()
            .map_err(|_| "INVALID_PORT")?,
        &value(&args, "--advertise-url").ok_or("CONFIG_MISSING advertise-url")?,
        &value(&args, "--central-base-url").ok_or("CONFIG_MISSING central-base-url")?,
    )
    .map_err(|e| format!("CONFIG_INVALID {e:?}"))?;
    let identity_store = IdentityStore::new(&root);
    let existing = identity_store
        .load()
        .map_err(|e| format!("IDENTITY_READ {e}"))?;
    match decide(&config.node_id, existing, generated_uuid_v4())
        .map_err(|e| format!("IDENTITY_INVALID {e:?}"))?
    {
        IdentityDecision::Create(i) => identity_store
            .create_if_absent(&i)
            .map_err(|e| format!("IDENTITY_WRITE {e}"))?,
        IdentityDecision::Reuse(_) => {}
    }
    let desired = DesiredStore::new(&root)
        .load_or_create()
        .map_err(|e| format!("DESIRED_INVALID {e}"))?;
    let _guard = WriterGuard::acquire(&root).map_err(|e| e.to_string())?;
    println!(
        "{{\"component\":\"dshd\",\"observed\":\"{:?}\",\"guard\":\"HELD\",\"pid\":{}}}",
        desired,
        std::process::id()
    );
    let Some(program) = value(&args, "--harness-program") else {
        if let Some(ms) = value(&args, "--hold-ms") {
            thread::sleep(Duration::from_millis(
                ms.parse().map_err(|_| "INVALID_HOLD")?,
            ));
        }
        return Ok(());
    };
    let cwd = PathBuf::from(value(&args, "--harness-cwd").ok_or("CONFIG_MISSING harness-cwd")?);
    let entries = [
        "--harness-entry",
        "--harness-entry-arg",
        "--harness-entry-arg2",
    ]
    .into_iter()
    .filter_map(|name| value(&args, name).map(PathBuf::from))
    .collect();
    let mut spec = harness_spec(PathBuf::from(program), entries, cwd);
    for (name, value) in std::env::vars() {
        let upper = name.to_ascii_uppercase();
        if !["KEY", "SECRET", "TOKEN", "PASSWORD"]
            .iter()
            .any(|sensitive| upper.contains(sensitive))
        {
            spec.env.push((name, value));
        }
    }
    let supervisor = Supervisor::new(
        spec,
        BackoffPolicy {
            initial: Duration::from_secs(1),
            maximum: Duration::from_secs(30),
        },
    );
    let executor = supervisor.clone();
    let coordinator = Coordinator::start(
        Snapshot {
            desired,
            ..Snapshot::default()
        },
        move |effect, feedback| executor.execute(effect, feedback),
    );
    if desired == dshd_core::state::DesiredState::Running {
        coordinator
            .send(Event::Reconcile)
            .map_err(|_| "COORDINATOR_CLOSED")?;
    }
    let command_tx = coordinator.sender();
    let signal_tx = command_tx.clone();
    ctrlc::set_handler(move || {
        let _ = signal_tx.send(Event::Shutdown);
    })
    .map_err(|error| format!("SIGNAL_HANDLER {error}"))?;
    thread::spawn(move || {
        for line in io::stdin().lock().lines().map_while(Result::ok) {
            match line.trim() {
                "shutdown" => {
                    let _ = command_tx.send(Event::Shutdown);
                    break;
                }
                "fence" => {
                    let _ = command_tx.send(Event::Fence);
                }
                _ => {}
            }
        }
    });
    let mut deadline = value(&args, "--hold-ms")
        .map(|ms| {
            ms.parse::<u64>()
                .map(|ms| Instant::now() + Duration::from_millis(ms))
        })
        .transpose()
        .map_err(|_| "INVALID_HOLD")?;
    let mut sequence = u64::MAX;
    loop {
        let snapshot = coordinator.snapshot();
        if snapshot.sequence != sequence {
            sequence = snapshot.sequence;
            let authority = snapshot
                .context
                .as_ref()
                .map(|c| c.authority.as_str())
                .unwrap_or("none");
            println!(
                "{{\"component\":\"dshd\",\"snapshot\":{},\"observed\":\"{:?}\",\"attempt\":{},\"generation\":{},\"authority\":\"{}\"}}",
                snapshot.sequence,
                snapshot.observed,
                snapshot.attempt.map_or(0, |a| a.0),
                snapshot.generation.0,
                authority
            );
        }
        if snapshot.shutdown && snapshot.observed == dshd_core::state::ObservedState::Stopped {
            break;
        }
        if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
            coordinator
                .send(Event::Shutdown)
                .map_err(|_| "COORDINATOR_CLOSED")?;
            deadline = None;
        }
        thread::sleep(Duration::from_millis(20));
    }
    Ok(())
}
fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
