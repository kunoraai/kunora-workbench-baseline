use std::{collections::HashSet, fs, path::PathBuf};
#[derive(Clone)]
struct Capability {
    id: String,
    kind: String,
    inventory: String,
    parity: String,
    status: String,
}
fn default_inventory() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("inventory.csv")
}
fn load(p: &PathBuf) -> Result<Vec<Capability>, String> {
    let text = fs::read_to_string(p).map_err(|e| format!("inventory {}: {e}", p.display()))?;
    let mut v = Vec::new();
    for (n, l) in text.lines().skip(1).enumerate() {
        let c: Vec<_> = l.split(',').collect();
        if c.len() != 6 {
            return Err(format!("line {} malformed", n + 2));
        }
        v.push(Capability {
            id: c[0].into(),
            kind: c[1].into(),
            inventory: c[3].into(),
            parity: c[4].into(),
            status: c[5].into(),
        })
    }
    Ok(v)
}
fn validate(v: &[Capability]) -> Result<(), String> {
    let mut ids = HashSet::new();
    for c in v {
        if !ids.insert(&c.id) {
            return Err(format!("duplicate {}", c.id));
        }
        if !matches!(c.kind.as_str(), "WUI" | "DSHD" | "OUT") {
            return Err(format!("unknown kind {}", c.kind));
        }
        if c.kind == "WUI" && (c.inventory.is_empty() != c.parity.is_empty()) {
            return Err(format!("partial evidence {}", c.id));
        }
    }
    for (prefix, n) in [("WUI", 21), ("DSHD", 4), ("OUT", 9)] {
        if v.iter().filter(|c| c.id.starts_with(prefix)).count() != n {
            return Err(format!("{prefix} count mismatch"));
        }
    }
    Ok(())
}
fn main() {
    let a: Vec<_> = std::env::args().collect();
    if a.iter().any(|x| x == "--version") {
        println!("capability-report 0.2.0");
        return;
    }
    let p = a
        .iter()
        .position(|x| x == "--inventory")
        .and_then(|i| a.get(i + 1))
        .map(PathBuf::from)
        .unwrap_or_else(default_inventory);
    let v = load(&p)
        .and_then(|v| {
            validate(&v)?;
            Ok(v)
        })
        .unwrap_or_else(|e| {
            eprintln!("SELF_TEST=FAIL {e}");
            std::process::exit(1)
        });
    let covered = v
        .iter()
        .filter(|c| {
            c.kind == "WUI"
                && !c.inventory.is_empty()
                && !c.parity.is_empty()
                && c.status == "COVERED"
        })
        .count();
    if a.iter().any(|x| x == "--self-test") {
        println!(
            "SELF_TEST=PASS inventory={} capabilities=34 covered={covered} parity_evidence=0",
            p.display()
        )
    } else if a.iter().any(|x| x == "--json") {
        println!("{{\"capabilities\":34,\"covered\":0,\"wui_parity\":0}}")
    } else {
        println!(
            "# Capability coverage\n\ncapabilities: 34; covered: {covered}; WUI parity: 0; NOT_IMPLEMENTED"
        )
    }
}
#[cfg(test)]
mod tests {
    #[test]
    fn inventory_exact() {
        let v = super::load(&super::default_inventory()).unwrap();
        super::validate(&v).unwrap();
    }
}
