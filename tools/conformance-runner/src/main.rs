use std::collections::HashSet;

const GROUPS: [(&str, usize); 7] = [
    ("ID", 4),
    ("CF", 4),
    ("ST", 14),
    ("PX", 13),
    ("SR", 13),
    ("CT", 15),
    ("PV", 3),
];

fn vectors() -> Vec<String> {
    GROUPS
        .iter()
        .flat_map(|(group, count)| (1..=*count).map(move |n| format!("{group}-{n:02}")))
        .collect()
}

fn self_test() -> Result<(), String> {
    let ids = vectors();
    let unique: HashSet<_> = ids.iter().collect();
    if ids.len() != 66 || unique.len() != 66 {
        return Err("manifest duplicate or count mismatch".into());
    }
    for (group, count) in GROUPS {
        if ids.iter().filter(|id| id.starts_with(group)).count() != count {
            return Err(format!("group {group} mismatch"));
        }
    }
    Ok(())
}

fn report() {
    println!("declared=66 executed=0 passed=0 failed=0");
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--version") => println!("conformance-runner 0.1.0"),
        Some("--self-test") => {
            self_test().unwrap_or_else(|e| panic!("{e}"));
            println!("SELF_TEST=PASS");
            report();
        }
        Some("--list") => {
            for id in vectors() {
                println!("{id} DECLARED NOT_IMPLEMENTED");
            }
            report();
        }
        _ => report(),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn manifest_is_exact() {
        super::self_test().unwrap();
    }
}
