use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
};
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
    let mut expected = BTreeMap::new();
    for n in 1..=21 {
        expected.insert(format!("WUI-{n:03}"), "WUI");
    }
    for n in 1..=4 {
        expected.insert(format!("DSHD-{n:03}"), "DSHD");
    }
    for n in 1..=9 {
        expected.insert(format!("OUT-{n:03}"), "OUT");
    }
    let mut ids = BTreeSet::new();
    for c in v {
        if !ids.insert(&c.id) {
            return Err(format!("duplicate {}", c.id));
        }
        let expected_kind = expected
            .get(&c.id)
            .ok_or_else(|| format!("unknown capability {}", c.id))?;
        if c.kind != *expected_kind {
            return Err(format!(
                "wrong kind for {}: expected {expected_kind}, got {}",
                c.id, c.kind
            ));
        }
        if !matches!(c.status.as_str(), "DECLARED" | "COVERED" | "EXCLUDED") {
            return Err(format!("illegal status {} for {}", c.status, c.id));
        }
        match c.status.as_str() {
            "DECLARED" if !c.inventory.is_empty() || !c.parity.is_empty() => {
                return Err(format!("declared capability has evidence {}", c.id));
            }
            "COVERED"
                if c.kind == "OUT"
                    || c.inventory.is_empty()
                    || (c.kind == "WUI" && c.parity.is_empty()) =>
            {
                return Err(format!(
                    "covered capability lacks consistent evidence {}",
                    c.id
                ));
            }
            "EXCLUDED" if c.kind != "OUT" || !c.inventory.is_empty() || !c.parity.is_empty() => {
                return Err(format!("invalid exclusion {}", c.id));
            }
            _ => {}
        }
        if c.kind == "WUI" && (c.inventory.is_empty() != c.parity.is_empty()) {
            return Err(format!("partial evidence {}", c.id));
        }
    }
    let expected_ids: BTreeSet<&String> = expected.keys().collect();
    if ids != expected_ids {
        return Err(format!(
            "capability set mismatch: expected {}, got {}",
            expected_ids.len(),
            ids.len()
        ));
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
    #[test]
    fn unknown_same_count_is_rejected() {
        let mut v = super::load(&super::default_inventory()).unwrap();
        v[0].id = "WUI-999".into();
        assert!(super::validate(&v).is_err());
    }
    #[test]
    fn wrong_kind_status_and_evidence_are_rejected() {
        let base = super::load(&super::default_inventory()).unwrap();
        for mutate in 0..3 {
            let mut v = base.clone();
            match mutate {
                0 => v[0].kind = "DSHD".into(),
                1 => v[0].status = "MAGIC".into(),
                _ => v[0].inventory = "orphan".into(),
            }
            assert!(super::validate(&v).is_err());
        }
    }
}
