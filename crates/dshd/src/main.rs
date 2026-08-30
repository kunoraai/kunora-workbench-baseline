use dshd_adapters::files::{DesiredStore, IdentityStore, WriterGuard, generated_uuid_v4};
use dshd_core::{
    config::ValidatedConfig,
    identity::{IdentityDecision, decide},
};
use std::{path::PathBuf, process::ExitCode, thread, time::Duration};

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
    if let Some(ms) = value(&args, "--hold-ms") {
        thread::sleep(Duration::from_millis(
            ms.parse().map_err(|_| "INVALID_HOLD")?,
        ));
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
