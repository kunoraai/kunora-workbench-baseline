use serde_yaml::{Mapping, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    path::{Path, PathBuf},
};
const VERSION: &str = "m1-controlled-generator/0.3.0";
fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}
fn key(s: &str) -> Value {
    Value::String(s.into())
}
fn get<'a>(m: &'a Mapping, s: &str) -> Option<&'a Value> {
    m.get(key(s))
}
fn map(v: &Value) -> Option<&Mapping> {
    v.as_mapping()
}
fn pascal(s: &str) -> String {
    s.split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|x| !x.is_empty())
        .map(|x| {
            let lowered = x.to_ascii_lowercase();
            let mut c = lowered.chars();
            c.next()
                .map(|h| h.to_ascii_uppercase().to_string() + c.as_str())
                .unwrap_or_default()
        })
        .collect()
}
fn variant(s: &str) -> String {
    let p = pascal(s);
    if p.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        format!("Value{p}")
    } else {
        p
    }
}
fn ref_name(v: &Value) -> Option<String> {
    v.as_str()?
        .strip_prefix("#/components/schemas/")
        .map(str::to_owned)
}
fn enum_def(name: &str, values: &[Value]) -> Result<String, String> {
    let mut out = format!(
        "#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]\npub enum {name} {{\n"
    );
    for v in values {
        let raw = v
            .as_str()
            .ok_or_else(|| format!("non-string enum in {name}"))?;
        out.push_str(&format!(
            "    #[serde(rename = {raw:?})]\n    {},\n",
            variant(raw)
        ));
    }
    out.push_str("}\n\n");
    Ok(out)
}
fn schema_type(schema: &Value, inline: &str, defs: &mut String) -> Result<String, String> {
    let m = map(schema).ok_or_else(|| format!("schema {inline} is not a mapping"))?;
    if let Some(r) = get(m, "$ref").and_then(ref_name) {
        return Ok(r);
    }
    if let Some(one) = get(m, "oneOf").and_then(Value::as_sequence) {
        let mut body = format!(
            "#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]\n#[serde(untagged)]\npub enum {inline} {{\n"
        );
        for (i, v) in one.iter().enumerate() {
            body.push_str(&format!(
                "    Variant{}({}),\n",
                i + 1,
                schema_type(v, &format!("{inline}Variant{}", i + 1), defs)?
            ));
        }
        body.push_str("}\n\n");
        defs.push_str(&body);
        return Ok(inline.into());
    }
    if let Some(vals) = get(m, "enum").and_then(Value::as_sequence) {
        defs.push_str(&enum_def(inline, vals)?);
        return Ok(inline.into());
    }
    if let Some(c) = get(m, "const").and_then(Value::as_str) {
        defs.push_str(&enum_def(inline, &[Value::String(c.into())])?);
        return Ok(inline.into());
    }
    match get(m, "type").and_then(Value::as_str) {
        Some("string") => Ok("String".into()),
        Some("integer") => Ok(
            if get(m, "format").and_then(Value::as_str) == Some("int32") {
                "i32"
            } else {
                "i64"
            }
            .into(),
        ),
        Some("number") => Ok("f64".into()),
        Some("boolean") => Ok("bool".into()),
        Some("null") => Ok("()".into()),
        Some("array") => Ok(format!(
            "Vec<{}>",
            schema_type(
                get(m, "items").ok_or("array items missing")?,
                &format!("{inline}Item"),
                defs
            )?
        )),
        Some("object") | None if get(m, "properties").is_some() => {
            render_object(inline, m, defs)?;
            Ok(inline.into())
        }
        Some("object") => Ok("std::collections::BTreeMap<String, serde_json::Value>".into()),
        x => Err(format!("unsupported schema type {x:?} in {inline}")),
    }
}
fn render_object(name: &str, m: &Mapping, defs: &mut String) -> Result<(), String> {
    let required: BTreeSet<_> = get(m, "required")
        .and_then(Value::as_sequence)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let mut nested = String::new();
    let mut fields = String::new();
    if let Some(props) = get(m, "properties").and_then(Value::as_mapping) {
        let mut sorted: Vec<_> = props.iter().collect();
        sorted.sort_by_key(|(k, _)| k.as_str());
        for (k, v) in sorted {
            let raw = k.as_str().ok_or("non-string property")?;
            let rust = if raw == "type" { "r#type" } else { raw };
            let ty = schema_type(v, &format!("{name}{}", pascal(raw)), &mut nested)?;
            let ty = if required.contains(raw) || ty.starts_with("Option<") {
                ty
            } else {
                format!("Option<{ty}>")
            };
            if map(v)
                .and_then(|x| get(x, "format"))
                .and_then(Value::as_str)
                == Some("date-time")
            {
                fields.push_str(
                    "    /// RFC 3339 date-time string from the frozen OpenAPI contract.\n",
                )
            }
            fields.push_str(&format!("    pub {rust}: {ty},\n"));
        }
    }
    let extra = if get(m, "additionalProperties").and_then(Value::as_bool) == Some(true) {
        "    #[serde(flatten)]\n    pub additional_properties: std::collections::BTreeMap<String, serde_json::Value>,\n"
    } else {
        ""
    };
    defs.push_str(&nested);
    defs.push_str(&format!("#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]\npub struct {name} {{\n{fields}{extra}}}\n\n"));
    Ok(())
}
fn render_named(name: &str, schema: &Value) -> Result<String, String> {
    let m = map(schema).ok_or_else(|| format!("schema {name} is not a mapping"))?;
    if let Some(vals) = get(m, "enum").and_then(Value::as_sequence) {
        return enum_def(name, vals);
    }
    // Object-level allOf entries can be conditional validation constraints.
    // Direct properties are the structural representation when present.
    if get(m, "type").and_then(Value::as_str) == Some("object") || get(m, "properties").is_some() {
        let mut d = String::new();
        render_object(name, m, &mut d)?;
        return Ok(d);
    }
    if let Some(all) = get(m, "allOf").and_then(Value::as_sequence) {
        let mut defs = String::new();
        let mut fields = String::new();
        let mut n = 0;
        for part in all {
            if let Some(r) = map(part).and_then(|x| get(x, "$ref")).and_then(ref_name) {
                n += 1;
                fields.push_str(&format!("    #[serde(flatten)]\n    pub base_{n}: {r},\n"));
            } else if let Some(pm) = map(part) {
                if get(pm, "properties").is_some() {
                    let helper = format!("{name}Part{}", n + 1);
                    render_object(&helper, pm, &mut defs)?;
                    n += 1;
                    fields.push_str(&format!(
                        "    #[serde(flatten)]\n    pub part_{n}: {helper},\n"
                    ));
                }
            }
        }
        if n == 0 {
            return Err(format!("allOf {name} has no structural members"));
        }
        defs.push_str(&format!("#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]\npub struct {name} {{\n{fields}}}\n\n"));
        return Ok(defs);
    }
    let mut defs = String::new();
    let ty = schema_type(schema, name, &mut defs)?;
    Ok(format!(
        "{defs}#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]\n#[serde(transparent)]\npub struct {name}(pub {ty});\n\n"
    ))
}
pub(crate) fn render(input: &str) -> Result<BTreeMap<String, String>, String> {
    let yaml: Value = serde_yaml::from_str(input).map_err(|e| e.to_string())?;
    let schemas = yaml
        .get("components")
        .and_then(|v| v.get("schemas"))
        .and_then(Value::as_mapping)
        .ok_or("components.schemas missing")?;
    if schemas.len() != 42 {
        return Err(format!("expected 42 schemas, got {}", schemas.len()));
    }
    let hash = format!("{:x}", Sha256::digest(input.as_bytes()));
    let mut entries: Vec<_> = schemas
        .iter()
        .map(|(n, s)| Ok((n.as_str().ok_or("non-string schema name")?.to_owned(), s)))
        .collect::<Result<_, String>>()?;
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    let header = format!("// @generated by {VERSION}; input-sha256={hash}; DO NOT EDIT.\n");
    let mut files = BTreeMap::new();
    files.insert("metadata.rs".into(),format!("{header}pub const GENERATOR_VERSION: &str = \"{VERSION}\";\npub const INPUT_SHA256: &str = \"{hash}\";\npub const SCHEMA_COUNT: usize = 42;\n"));
    let mut types = header.clone();
    for (name, schema) in &entries {
        types.push_str(&render_named(name, schema)?)
    }
    files.insert("types.rs".into(), types);
    let mut names = format!("{header}pub const SCHEMA_NAMES: &[&str] = &[\n");
    for (name, _) in &entries {
        names.push_str(&format!("    \"{name}\",\n"))
    }
    names.push_str("];\n");
    files.insert("schema_names.rs".into(), names);
    files.insert("mod.rs".into(),format!("{header}mod metadata;\nmod schema_names;\nmod types;\npub use metadata::*;\npub use schema_names::*;\npub use types::*;\n"));
    Ok(files)
}
fn run(base: &Path, check: bool) -> Result<(), String> {
    let input = fs::read_to_string(base.join("docs/contracts/central-dshd-openapi.yaml"))
        .map_err(|e| e.to_string())?;
    let rendered = render(&input)?;
    let out = base.join("crates/dshd-contract/src/generated");
    if check {
        let drift: Vec<_> = rendered
            .iter()
            .filter_map(|(n, e)| {
                let p = out.join(n);
                (fs::read_to_string(&p).ok().as_deref() != Some(e)).then(|| p.display().to_string())
            })
            .collect();
        if drift.is_empty() {
            println!("RESULT=PASS ZERO_DRIFT files={}", rendered.len());
            Ok(())
        } else {
            Err(format!("generated drift: {}", drift.join(", ")))
        }
    } else {
        fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        for (n, c) in rendered {
            fs::write(out.join(n), c).map_err(|e| e.to_string())?
        }
        println!("RESULT=PASS REGENERATED schemas=42 generator={VERSION}");
        Ok(())
    }
}
fn main() {
    let mut check = None;
    let mut base = root();
    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--check" => check = Some(true),
            "--regen" => check = Some(false),
            "--root" => base = PathBuf::from(args.next().unwrap_or_default()),
            _ => {
                eprintln!("unknown argument: {arg}");
                std::process::exit(2)
            }
        }
    }
    if let Err(e) = run(&base, check.unwrap_or(true)) {
        eprintln!("RESULT=FAIL {e}");
        std::process::exit(1)
    }
}
#[cfg(test)]
#[path = "golden_tests.rs"]
mod golden_tests;
