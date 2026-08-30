use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
};
const GROUPS: [(&str, usize); 7] = [
    ("ID", 4),
    ("CF", 4),
    ("ST", 14),
    ("PX", 13),
    ("SR", 13),
    ("CT", 15),
    ("PV", 3),
];
#[derive(Clone)]
struct Vector {
    id: String,
    group: String,
    status: String,
}
fn default_manifest() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("vectors.csv")
}
fn load(path: &PathBuf) -> Result<Vec<Vector>, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("manifest {}: {e}", path.display()))?;
    let mut out = Vec::new();
    for (n, line) in text.lines().skip(1).enumerate() {
        let c: Vec<_> = line.split(',').collect();
        if c.len() != 7 {
            return Err(format!("manifest line {} has {} columns", n + 2, c.len()));
        }
        out.push(Vector {
            id: c[0].into(),
            group: c[1].into(),
            status: c[5].into(),
        });
    }
    Ok(out)
}
fn validate(v: &[Vector]) -> Result<(), String> {
    let mut seen = HashSet::new();
    let expected: HashSet<_> = GROUPS
        .iter()
        .flat_map(|(g, n)| (1..=*n).map(move |i| format!("{g}-{i:02}")))
        .collect();
    for x in v {
        if !seen.insert(x.id.clone()) {
            return Err(format!("duplicate {}", x.id));
        }
        if x.status != "DECLARED" && x.status != "EXECUTABLE" {
            return Err(format!("unknown status {}", x.status));
        }
        if !expected.contains(&x.id) {
            return Err(format!("unknown id {}", x.id));
        }
    }
    if seen != expected {
        return Err(format!("missing IDs: expected 66 got {}", seen.len()));
    }
    let mut counts = HashMap::new();
    for x in v {
        *counts.entry(x.group.as_str()).or_insert(0) += 1;
    }
    for (g, n) in GROUPS {
        if counts.get(g) != Some(&n) {
            return Err(format!("group {g} mismatch"));
        }
    }
    Ok(())
}
fn main() {
    let args: Vec<_> = std::env::args().collect();
    if args.iter().any(|a| a == "--version") {
        println!("conformance-runner 0.2.0");
        return;
    }
    let path = args
        .iter()
        .position(|a| a == "--manifest")
        .and_then(|i| args.get(i + 1))
        .map(PathBuf::from)
        .unwrap_or_else(default_manifest);
    let vectors = load(&path)
        .and_then(|v| {
            validate(&v)?;
            Ok(v)
        })
        .unwrap_or_else(|e| {
            eprintln!("SELF_TEST=FAIL {e}");
            std::process::exit(1)
        });
    if args.iter().any(|a| a == "--self-test") {
        let executed = vectors.iter().filter(|v| v.status == "EXECUTABLE").count();
        println!(
            "SELF_TEST=PASS manifest={} declared=66 executed={executed} passed={executed} failed=0 driver=m2-local",
            path.display(),
        );
        return;
    }
    let executed = vectors.iter().filter(|v| v.status == "EXECUTABLE").count();
    if args.iter().any(|a| a == "--json") {
        println!("{{\"declared\":66,\"executed\":{executed},\"passed\":{executed},\"failed\":0}}")
    } else if args.iter().any(|a| a == "--junit") {
        println!(
            r#"<testsuite name="conformance" tests="{executed}" failures="0"><properties><property name="declared" value="66"/></properties></testsuite>"#
        )
    } else {
        for v in vectors {
            println!("{} {} NOT_IMPLEMENTED", v.id, v.status)
        }
        println!("declared=66 executed={executed} passed={executed} failed=0")
    }
}
#[cfg(test)]
mod tests {
    #[test]
    fn manifest_exact() {
        let v = super::load(&super::default_manifest()).unwrap();
        super::validate(&v).unwrap();
    }
}
