# M1 iteration 3 — F13/F14/F15 fixes

Date: 2026-08-29  
Author: Remote Agent

## Scope

This iteration is limited to acceptance R2 findings F13, F14, and F15. Frozen contracts, review documents, `dsh/`, the 66-vector manifest, and M2+ behavior remain unchanged. The honest M1 boundary remains `declared=66, executed=0`; stub business behavior remains `NOT_IMPLEMENTED`; capability coverage remains zero with parity evidence pending.

## F13 — schema-derived Rust DTOs

The controlled generator now recursively maps object properties, required versus optional fields, references, strings, integer formats, numbers, booleans, arrays, string enums, constants, nullable/general `oneOf`, structural `allOf`, and open `additionalProperties`. Date-time strings have an explicit RFC 3339 mapping comment. The 42 generated schemas are re-exported by `dshd-contract`; scalar schemas are typed newtypes rather than arbitrary-JSON wrappers.

`tools/contract-gen/src/golden_tests.rs` proves deterministic output and verifies that property, enum, and union mutations change generated Rust. The managed output is regenerated solely from `docs/contracts/central-dshd-openapi.yaml`; `--check` and `--regen` retain their clean/drift semantics.

## F14 — route-registry-driven reference stub

`reference-stub` now has one `ROUTES` registry containing the 13 frozen Registry and Management/Proxy routes: three registry operations, status, three health routes, three lifecycle routes, operation lookup, opaque `/api/**`, and `/api/remote.mux`. Dispatch matching, client probes, and the reported denominator all derive from this registry. `--self-test` requests every entry, requires HTTP success with the explicit `NOT_IMPLEMENTED` body, and reports `route_probe=13/13 PASS`. The register/heartbeat/deregister route behavior remains present.

## F15 — exact capability inventory validation

The capability tool builds the exact expected ID/kind mapping for WUI-001..021, DSHD-001..004, and OUT-001..009, compares it with the actual `BTreeSet`, and rejects duplicates, unknown or missing IDs, wrong kinds, illegal statuses, and inconsistent status/evidence combinations. Unit tests include the same-count `WUI-001` to `WUI-999` replacement and wrong-kind/status/evidence cases. JSON and Markdown continue to derive from the same validated in-memory inventory and report 34 capabilities, zero covered.

## Evidence

Before the final five-mode acceptance run, the following focused checks passed locally:

- `cargo check --locked -p dshd-contract -p contract-gen`
- `cargo test --locked -p contract-gen`: 2/2 golden tests passed
- `cargo test --locked -p capability-report`: 3/3 validation tests passed
- `cargo run --locked -p contract-gen -- --regen`: `schemas=42`
- `cargo run --locked -p reference-stub -- --self-test`: `route_probe=13/13 PASS`
- `cargo run --locked -p capability-report -- --self-test`: `capabilities=34 covered=0 parity_evidence=0`

The final five mechanical modes are run after committing because the structural checker intentionally requires a clean, committed worktree. Their results are recorded in the final task handoff and are not pre-declared here.
