"""Validate the frozen central-service/dshd design contracts.

Run from any directory after installing requirements-contracts.txt:
    python docs/contracts/validate_contracts.py
"""

from __future__ import annotations

import json
import copy
import re
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate_spec


CONTRACT_DIR = Path(__file__).resolve().parent
DOCS_DIR = CONTRACT_DIR.parent
OPENAPI_PATH = CONTRACT_DIR / "central-dshd-openapi.yaml"
INTERFACE_PATH = DOCS_DIR / "interfaces" / "central-dshd-interface-spec.md"
HLD_PATH = DOCS_DIR / "backend-node-hld.md"
CONFORMANCE_PATH = CONTRACT_DIR / "central-dshd-conformance.md"
CAPABILITY_PATH = CONTRACT_DIR / "harness-web-capabilities.yaml"
CAPABILITY_BASELINE_PATH = DOCS_DIR / "dsh" / "harness-web-capability-baseline.md"
DSHD_DESIGN_PATH = DOCS_DIR / "dshd-service-design.md"
INTERFACE_EXAMPLE_SCHEMAS = (
    "RegistrationRequest",
    "RegistrationResponse",
    "HeartbeatRequest",
    "HeartbeatResponse",
    "StatusResponse",
    "LifecycleRequest",
    "Operation",
    "Operation",
    "ErrorResponse",
)
EXPECTED_CONFORMANCE_RANGES = {
    "ID": 4,
    "CF": 4,
    "ST": 14,
    "PX": 13,
    "SR": 13,
    "CT": 15,
    "PV": 3,
}
EXPECTED_CAPABILITY_RANGES = {
    "WUI": 21,
    "DSHD": 4,
    "OUT": 9,
}


def fail(message: str) -> None:
    raise AssertionError(message)


def github_heading_slug(heading: str) -> str:
    """Return the GitHub-style anchor used by the project's Markdown headings."""
    plain = re.sub(r"\[([^]]+)]\([^)]+\)", r"\1", heading)
    plain = re.sub(r"<[^>]*>", "", plain).strip().lower()
    plain = re.sub(r"[^\w\s-]", "", plain, flags=re.UNICODE)
    return re.sub(r"\s+", "-", plain)


def markdown_heading_anchors(path: Path) -> set[str]:
    """Collect anchors for ATX headings, including GitHub duplicate suffixes."""
    anchors: set[str] = set()
    occurrences: dict[str, int] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\s{0,3}#{1,6}\s+(.+?)\s*$", line)
        if match is None:
            continue
        heading = re.sub(r"\s+#+\s*$", "", match.group(1))
        base = github_heading_slug(heading)
        if not base:
            continue
        occurrence = occurrences.get(base, 0)
        anchor = base if occurrence == 0 else f"{base}-{occurrence}"
        occurrences[base] = occurrence + 1
        anchors.add(anchor)
    return anchors


def validate_evidence_locator(
    capability_id: str,
    locator: Any,
    anchor_cache: dict[Path, set[str]],
) -> None:
    """Require a capability evidence locator to resolve to a local Markdown heading."""
    if not isinstance(locator, str) or not locator.strip():
        fail(f"{capability_id} evidence locator must be a non-empty string")
    path_text, separator, anchor = locator.partition("#")
    if not separator or not path_text or not anchor:
        fail(f"{capability_id} evidence must include a Markdown heading anchor: {locator}")

    linked = (DOCS_DIR / path_text).resolve()
    try:
        linked.relative_to(DOCS_DIR.resolve())
    except ValueError:
        fail(f"{capability_id} evidence escapes docs directory: {path_text}")
    if linked.suffix.lower() != ".md" or not linked.is_file():
        fail(f"{capability_id} evidence Markdown file does not exist: {path_text}")

    if linked not in anchor_cache:
        anchor_cache[linked] = markdown_heading_anchors(linked)
    anchors = anchor_cache[linked]
    if anchor not in anchors:
        fail(f"{capability_id} evidence heading does not exist: {locator}")


def walk_refs(value: Any) -> list[str]:
    refs: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "$ref" and isinstance(child, str):
                refs.append(child)
            refs.extend(walk_refs(child))
    elif isinstance(value, list):
        for child in value:
            refs.extend(walk_refs(child))
    return refs


def resolve_local_ref(document: dict[str, Any], ref: str) -> Any:
    if not ref.startswith("#/"):
        fail(f"External OpenAPI ref is not allowed: {ref}")
    value: Any = document
    for raw_part in ref[2:].split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or part not in value:
            fail(f"Unresolved OpenAPI ref: {ref}")
        value = value[part]
    return value


def iter_operations(document: dict[str, Any]):
    methods = {"get", "put", "post", "delete", "patch", "head", "options", "trace"}
    for path, item in document["paths"].items():
        resolved = resolve_local_ref(document, item["$ref"]) if "$ref" in item else item
        for method in methods:
            if method in resolved:
                yield path, method, resolved[method]


def validate_response_contracts(document: dict[str, Any]) -> tuple[int, int]:
    expected_response_refs = {
        "400": "#/components/responses/BadRequest",
        "401": "#/components/responses/Unauthenticated",
        "403": "#/components/responses/Forbidden",
        "404": "#/components/responses/NotFound",
        "409": "#/components/responses/Conflict",
        "413": "#/components/responses/PayloadTooLarge",
        "422": "#/components/responses/Unprocessable",
        "426": "#/components/responses/UpgradeRequired",
    }
    protected = 0
    mapped = 0
    inherited_security = document.get("security")
    for path, method, operation in iter_operations(document):
        security = operation.get("security", inherited_security)
        responses = operation["responses"]
        if security != []:
            protected += 1
            missing = {"400", "401", "403"} - set(responses)
            if missing:
                fail(f"Protected operation lacks common errors: {method.upper()} {path} -> {sorted(missing)}")
        for status, expected_ref in expected_response_refs.items():
            if status not in responses:
                continue
            mapped += 1
            actual_ref = responses[status].get("$ref")
            if actual_ref != expected_ref:
                fail(
                    f"HTTP/error mapping drift: {method.upper()} {path} {status} "
                    f"uses {actual_ref}, expected {expected_ref}"
                )

    if any("metrics" in path or "logs" in path for path in document["paths"]):
        fail("MVP OpenAPI must not expose metrics or log retrieval paths")

    schemas = document["components"]["schemas"]
    for schema_name in ("HeartbeatRequest", "StatusResponse"):
        if "resources" not in schemas[schema_name]["required"]:
            fail(f"{schema_name} must require the closed MVP resource metric set")
    return protected, mapped


def validate_openapi() -> tuple[dict[str, Any], int, int, int]:
    document = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
    validate_spec(document)

    expected_transport = {
        "control_json_decompressed_max_bytes": 65536,
        "request_header_section_max_bytes": 65536,
        "application_rate_limit": False,
        "generates_http_429": False,
        "single_service_port": True,
        "default_listen_port": 8080,
        "listen_port_min": 1024,
        "listen_port_max": 65535,
    }
    if document.get("x-dshd-transport") != expected_transport:
        fail(f"Transport contract drift: {document.get('x-dshd-transport')}")

    refs = walk_refs(document)
    for ref in refs:
        resolve_local_ref(document, ref)

    paths = document["paths"]
    for path, item in paths.items():
        resolved = resolve_local_ref(document, item["$ref"]) if "$ref" in item else item
        servers = resolved.get("servers", [])
        if len(servers) != 1:
            fail(f"{path} must declare exactly one authoritative server")
        server_url = servers[0]["url"]
        if path.startswith("/internal/") and server_url != "https://central.example.invalid":
            fail(f"Registry path has wrong server: {path} -> {server_url}")
        if path.startswith("/daemon/"):
            if server_url != "http://dshd:{port}":
                fail(f"Management path has wrong server: {path} -> {server_url}")
            port_variable = servers[0].get("variables", {}).get("port", {})
            if port_variable.get("default") != "8080":
                fail(f"Management path has wrong default port: {path} -> {port_variable}")

    expected_states = {
        "DaemonState": ["STARTING", "READY", "STOPPING"],
        "RegistrationState": ["UNREGISTERED", "REGISTERING", "LEASED", "DEGRADED", "FENCED"],
        "HarnessState": ["STOPPED", "STARTING", "AUTHENTICATING", "READY", "UNHEALTHY", "STOPPING"],
        "DesiredHarnessState": ["RUNNING", "STOPPED"],
    }
    schemas = document["components"]["schemas"]
    advertise_url_schema = schemas["RegistrationRequest"]["properties"]["advertise_url"]
    if advertise_url_schema.get("x-explicit-port-min") != 1 or advertise_url_schema.get("x-explicit-port-max") != 65535:
        fail(f"Advertise URL port range drift: {advertise_url_schema}")
    advertise_pattern = re.compile(advertise_url_schema["pattern"])
    valid_advertise_urls = (
        "http://10.0.12.34:8080",
        "http://dshd.internal:443",
        "http://[fd00::12]:18080",
    )
    invalid_advertise_urls = (
        "http://10.0.12.34",
        "http://user@10.0.12.34:8080",
        "http://10.0.12.34:8080/path",
        "http://10.0.12.34:8080?query=1",
    )
    if any(not advertise_pattern.fullmatch(value) for value in valid_advertise_urls):
        fail("Advertise URL pattern rejects a valid configured endpoint")
    if any(advertise_pattern.fullmatch(value) for value in invalid_advertise_urls):
        fail("Advertise URL pattern accepts an endpoint that must fail closed")
    for schema_name, expected in expected_states.items():
        actual = schemas[schema_name]["enum"]
        if actual != expected:
            fail(f"{schema_name} enum drift: {actual}")

    capability_rules = schemas["RegistrationRequest"]["properties"]["capabilities"]["allOf"]
    actual_capabilities = {rule["contains"]["const"] for rule in capability_rules}
    expected_capabilities = {
        "daemon.lifecycle.v1",
        "harness.http-proxy.v1",
        "harness.remote-mux.v1",
        "harness.session-export.v1",
    }
    if actual_capabilities != expected_capabilities:
        fail(f"Required capabilities drift: {sorted(actual_capabilities)}")

    interface_text = INTERFACE_PATH.read_text(encoding="utf-8")
    documented_errors = set(
        re.findall(r"^\| [0-9]{3} \| `([A-Z][A-Z0-9_]+)` \|", interface_text, re.MULTILINE)
    )
    schema_errors = set(schemas["ErrorEnvelope"]["properties"]["code"]["enum"])
    if documented_errors != schema_errors:
        fail(
            "Error code drift: "
            f"doc_only={sorted(documented_errors - schema_errors)}, "
            f"schema_only={sorted(schema_errors - documented_errors)}"
        )

    return document, len(paths), len(schemas), len(refs)


def schema_validator(document: dict[str, Any], schema_name: str) -> Draft202012Validator:
    schema = document["components"]["schemas"][schema_name]
    root = Draft202012Validator(document, format_checker=FormatChecker())
    return root.evolve(schema=schema)


def expect_valid(document: dict[str, Any], schema_name: str, value: Any, label: str) -> None:
    errors = sorted(schema_validator(document, schema_name).iter_errors(value), key=lambda item: list(item.path))
    if errors:
        detail = "; ".join(error.message for error in errors[:3])
        fail(f"{label} does not satisfy {schema_name}: {detail}")


def expect_invalid(document: dict[str, Any], schema_name: str, value: Any, label: str) -> None:
    if not list(schema_validator(document, schema_name).iter_errors(value)):
        fail(f"Negative schema case unexpectedly passed: {label} -> {schema_name}")


def validate_error_response_schemas(document: dict[str, Any]) -> tuple[int, int]:
    allowed = {
        "BadRequestErrorResponse": ["INVALID_REQUEST"],
        "UnauthenticatedErrorResponse": ["UNAUTHENTICATED"],
        "ForbiddenErrorResponse": ["NODE_ID_MISMATCH"],
        "NotFoundErrorResponse": ["NOT_FOUND"],
        "ConflictErrorResponse": [
            "NODE_INSTANCE_CONFLICT",
            "STORAGE_ID_MISMATCH",
            "STALE_INSTANCE",
            "NODE_FENCED",
            "NODE_NOT_LEASED",
            "GENERATION_MISMATCH",
            "OPERATION_CONFLICT",
            "IDEMPOTENCY_KEY_REUSE",
        ],
        "PayloadTooLargeErrorResponse": ["PAYLOAD_TOO_LARGE"],
        "UnprocessableErrorResponse": ["INVALID_ADVERTISE_URL"],
        "UpgradeRequiredErrorResponse": ["PROTOCOL_UNSUPPORTED"],
    }
    valid = 0
    invalid = 0
    for schema_name, codes in allowed.items():
        for code in codes:
            value = {
                "error": {
                    "code": code,
                    "message": "contract test",
                    "retryable": False,
                    "request_id": "41fc2103-5881-4278-849c-297bc7b32a1b",
                    "details": {},
                }
            }
            expect_valid(document, schema_name, value, f"{schema_name} accepts {code}")
            valid += 1
        wrong = {
            "error": {
                "code": "HARNESS_TIMEOUT",
                "message": "wrong status mapping",
                "retryable": True,
                "request_id": "41fc2103-5881-4278-849c-297bc7b32a1b",
                "details": {},
            }
        }
        expect_invalid(document, schema_name, wrong, f"{schema_name} rejects HARNESS_TIMEOUT")
        invalid += 1
    return valid, invalid


def validate_operation_variants(document: dict[str, Any], examples: list[Any]) -> tuple[int, int]:
    operation_id = "c6464d38-98cd-494c-9f79-01f03bd1fca8"
    requested = "2026-08-29T10:32:00.000Z"
    started = "2026-08-29T10:32:00.010Z"
    finished = "2026-08-29T10:32:04.200Z"
    error = {
        "code": "DAEMON_RESTARTED",
        "message": "daemon restarted",
        "retryable": True,
        "at": finished,
    }
    positives = [
        {
            "operation_id": operation_id,
            "type": "START",
            "state": "PENDING",
            "no_op": False,
            "requested_at": requested,
        },
        copy.deepcopy(examples[6]),
        {
            "operation_id": operation_id,
            "type": "START",
            "state": "SUCCEEDED",
            "no_op": False,
            "requested_at": requested,
            "started_at": started,
            "finished_at": finished,
            "result": {"current_generation": 1, "harness_state": "READY"},
            "error": None,
        },
        {
            "operation_id": operation_id,
            "type": "STOP",
            "state": "SUCCEEDED",
            "no_op": False,
            "requested_at": requested,
            "started_at": started,
            "finished_at": finished,
            "result": {"current_generation": 1, "harness_state": "STOPPED"},
            "error": None,
        },
        copy.deepcopy(examples[7]),
        {
            "operation_id": operation_id,
            "type": "STOP",
            "state": "SUCCEEDED",
            "no_op": True,
            "requested_at": requested,
            "finished_at": finished,
            "result": {"current_generation": 1, "harness_state": "STOPPED"},
            "error": None,
        },
        {
            "operation_id": operation_id,
            "type": "START",
            "state": "FAILED",
            "no_op": False,
            "requested_at": requested,
            "finished_at": finished,
            "error": error,
        },
    ]
    for index, value in enumerate(positives, start=1):
        expect_valid(document, "Operation", value, f"valid operation variant #{index}")

    running_finished = copy.deepcopy(examples[6])
    running_finished.update(
        {
            "finished_at": finished,
            "result": {"current_generation": 2, "harness_state": "READY"},
            "error": None,
        }
    )
    stop_ready = copy.deepcopy(positives[3])
    stop_ready["result"]["harness_state"] = "READY"
    restart_missing_previous = copy.deepcopy(examples[7])
    del restart_missing_previous["result"]["previous_generation"]
    pending_started = copy.deepcopy(positives[0])
    pending_started["started_at"] = started
    failed_result = copy.deepcopy(positives[6])
    failed_result["result"] = {"current_generation": 0, "harness_state": "STOPPED"}
    succeeded_missing_error = copy.deepcopy(positives[2])
    del succeeded_missing_error["error"]
    noop_started = copy.deepcopy(positives[5])
    noop_started["started_at"] = started
    negatives = [
        running_finished,
        stop_ready,
        restart_missing_previous,
        pending_started,
        failed_result,
        succeeded_missing_error,
        noop_started,
    ]
    for index, value in enumerate(negatives, start=1):
        expect_invalid(document, "Operation", value, f"invalid operation variant #{index}")
    return len(positives), len(negatives)


def validate_json_examples(document: dict[str, Any]) -> tuple[list[Any], int, int]:
    text = INTERFACE_PATH.read_text(encoding="utf-8")
    blocks = re.findall(r"```json\s*(.*?)```", text, re.DOTALL)
    if len(blocks) != len(INTERFACE_EXAMPLE_SCHEMAS):
        fail(
            "Interface example count/order drift: "
            f"expected {len(INTERFACE_EXAMPLE_SCHEMAS)}, got {len(blocks)}"
        )
    examples: list[Any] = []
    for index, (block, schema_name) in enumerate(zip(blocks, INTERFACE_EXAMPLE_SCHEMAS), start=1):
        try:
            example = json.loads(block)
        except json.JSONDecodeError as error:
            fail(f"Invalid JSON example #{index}: {error}")
        expect_valid(document, schema_name, example, f"Interface JSON example #{index}")
        examples.append(example)

    missing_desired = copy.deepcopy(examples[0])
    del missing_desired["harness"]["desired_state"]
    expect_invalid(document, "RegistrationRequest", missing_desired, "registration missing desired_state")

    heartbeat_missing_desired = copy.deepcopy(examples[2])
    del heartbeat_missing_desired["harness"]["desired_state"]
    expect_invalid(
        document,
        "HeartbeatRequest",
        heartbeat_missing_desired,
        "heartbeat missing desired_state",
    )

    status_missing_desired = copy.deepcopy(examples[4])
    del status_missing_desired["harness"]["desired_state"]
    expect_invalid(document, "StatusResponse", status_missing_desired, "status missing desired_state")

    status_missing_resources = copy.deepcopy(examples[4])
    del status_missing_resources["resources"]
    expect_invalid(document, "StatusResponse", status_missing_resources, "status missing resources")

    for field in ("pid", "started_at"):
        ready_missing_process = copy.deepcopy(examples[4])
        del ready_missing_process["harness"][field]
        expect_invalid(document, "StatusResponse", ready_missing_process, f"READY missing {field}")

    for field in ("lease_expires_at", "last_heartbeat_at"):
        leased_missing_time = copy.deepcopy(examples[4])
        del leased_missing_time["registration"][field]
        expect_invalid(document, "StatusResponse", leased_missing_time, f"LEASED missing {field}")

    stopped_with_process = copy.deepcopy(examples[4])
    stopped_with_process["harness"]["state"] = "STOPPED"
    expect_invalid(document, "StatusResponse", stopped_with_process, "STOPPED carrying pid/started_at")

    for state in ("UNREGISTERED", "REGISTERING"):
        inactive_with_times = copy.deepcopy(examples[4])
        inactive_with_times["registration"]["state"] = state
        expect_invalid(
            document,
            "StatusResponse",
            inactive_with_times,
            f"{state} carrying lease times",
        )

    stopped_unregistered = copy.deepcopy(examples[4])
    stopped_unregistered["harness"]["desired_state"] = "STOPPED"
    stopped_unregistered["harness"]["state"] = "STOPPED"
    del stopped_unregistered["harness"]["pid"]
    del stopped_unregistered["harness"]["started_at"]
    stopped_unregistered["registration"] = {"state": "UNREGISTERED"}
    expect_valid(document, "StatusResponse", stopped_unregistered, "valid STOPPED/UNREGISTERED status")

    fenced_stopped = copy.deepcopy(stopped_unregistered)
    fenced_stopped["harness"]["desired_state"] = "RUNNING"
    fenced_stopped["registration"] = copy.deepcopy(examples[4]["registration"])
    fenced_stopped["registration"]["state"] = "FENCED"
    expect_valid(document, "StatusResponse", fenced_stopped, "valid FENCED status retaining desired state")

    return examples, 2, 11


def validate_capability_baseline() -> tuple[int, int, int, int]:
    document = yaml.safe_load(CAPABILITY_PATH.read_text(encoding="utf-8"))
    if document.get("version") != "1.0.4" or document.get("status") != "frozen":
        fail("Capability baseline must be frozen at version 1.0.4")
    harness = document.get("harness", {})
    if harness != {
        "tag": "dsh-v0.1.2-alpha.1",
        "commit": "cd5ef8148158c3a752a658978873241fdf8e2bbc",
    }:
        fail(f"Capability/Harness baseline drift: {harness}")
    if document.get("scope") != "official_web_ui_backend_parity":
        fail(f"Capability scope drift: {document.get('scope')}")

    expected_scope_semantics = {
        "status": "frozen",
        "web_ui": "harness_owned_proxy_parity_only",
        "dshd": "dshd_owned_implementation",
        "mvp_excluded": "no_implementation_required",
    }
    scope_semantics = document.get("scope_semantics", {})
    if scope_semantics != expected_scope_semantics:
        fail(f"Capability scope semantics drift: {scope_semantics}")

    policy = document.get("acceptance_policy", {})
    expected_policy = {
        "all_web_ui_ids_must_pass": True,
        "coverage_report_required": True,
        "web_ui_methods": ["inventory_contract", "parity_e2e"],
        "dshd_supplement_methods": ["contract_test", "e2e"],
        "excluded_methods": ["boundary_review"],
    }
    if policy != expected_policy:
        fail(f"Capability acceptance policy drift: {policy}")

    capabilities = document.get("capabilities")
    if not isinstance(capabilities, list):
        fail("Capability registry must contain a capabilities list")
    ids = [item.get("id") for item in capabilities if isinstance(item, dict)]
    if len(ids) != len(capabilities) or len(ids) != len(set(ids)):
        fail("Capability IDs must be present and unique")
    expected_ids = {
        f"{group}-{number:03d}"
        for group, last in EXPECTED_CAPABILITY_RANGES.items()
        for number in range(1, last + 1)
    }
    actual_ids = set(ids)
    if actual_ids != expected_ids:
        fail(
            "Capability ID set drift: "
            f"missing={sorted(expected_ids - actual_ids)}, "
            f"unexpected={sorted(actual_ids - expected_ids)}"
        )

    expected_by_classification = {
        "web_ui": set(policy["web_ui_methods"]),
        "dshd_supplement": set(policy["dshd_supplement_methods"]),
        "mvp_excluded": set(policy["excluded_methods"]),
    }
    allowed_transports = {
        "remote_http",
        "remote_mux",
        "fetch_http",
        "daemon_http",
        "registry_http",
        "container_logs",
        "none",
    }
    allowed_phases = {f"M{number}" for number in range(9)}
    counts = {classification: 0 for classification in expected_by_classification}
    anchor_cache: dict[Path, set[str]] = {}
    evidence_count = 0
    for item in capabilities:
        capability_id = item["id"]
        required_fields = {
            "classification",
            "domain",
            "capability",
            "transports",
            "implementation_phases",
            "acceptance_methods",
            "evidence",
        }
        missing_fields = required_fields - set(item)
        if missing_fields:
            fail(f"{capability_id} lacks fields: {sorted(missing_fields)}")
        classification = item["classification"]
        if classification not in expected_by_classification:
            fail(f"{capability_id} has unknown classification: {classification}")
        counts[classification] += 1
        if set(item["acceptance_methods"]) != expected_by_classification[classification]:
            fail(f"{capability_id} acceptance method drift: {item['acceptance_methods']}")
        transports = set(item["transports"])
        phases = set(item["implementation_phases"])
        if not transports or not transports <= allowed_transports:
            fail(f"{capability_id} transport drift: {sorted(transports)}")
        if not phases <= allowed_phases:
            fail(f"{capability_id} phase drift: {sorted(phases)}")
        if classification == "web_ui":
            if not phases or not phases <= {"M4", "M5"} or "none" in transports:
                fail(f"{capability_id} must map to M4/M5 and a real Harness transport")
        elif classification == "dshd_supplement":
            if not phases or not phases <= {"M3", "M6", "M7"} or "none" in transports:
                fail(f"{capability_id} must map to M3/M6/M7 and a dshd output transport")
        else:
            if phases or transports != {"none"}:
                fail(f"{capability_id} is excluded and must not own implementation work")
        validate_evidence_locator(capability_id, item["evidence"], anchor_cache)
        evidence_count += 1

    baseline_text = CAPABILITY_BASELINE_PATH.read_text(encoding="utf-8")
    for marker in (
        "`WUI-001`～`WUI-021`",
        "`DSHD-001`～`DSHD-004`",
        "`OUT-001`～`OUT-009`",
        "inventory contract",
        "parity E2E",
    ):
        if marker not in baseline_text:
            fail(f"Capability baseline marker missing: {marker}")
    return (
        counts["web_ui"],
        counts["dshd_supplement"],
        counts["mvp_excluded"],
        evidence_count,
    )


def validate_cross_contract_rules() -> int:
    interface_text = INTERFACE_PATH.read_text(encoding="utf-8")
    hld_text = HLD_PATH.read_text(encoding="utf-8")
    required_interface_markers = (
        "/etc/dshd/node-id",
        "DSHD_ADVERTISE_URL",
        "1024..65535",
        "禁止从 listener",
        "usable_key = (node_id, storage_id, instance_id, lease_id, generation)",
        "不得因方法“幂等”而隐式自动重试",
        "RFC 8785",
        "MVP 不增加日志读取 API 或 `/metrics` endpoint",
    )
    for marker in required_interface_markers:
        if marker not in interface_text:
            fail(f"Required interface invariant missing: {marker}")
    required_hld_markers = (
        "预登记 node_id/token",
        "DSHD_ADVERTISE_URL",
        "1024..65535",
        "中央 reference stub",
        "验收环境清单",
        "usable_key=(node_id,storage_id,instance_id,lease_id,generation)",
        "已提交响应只能终止流",
        "无 `/metrics`",
    )
    for marker in required_hld_markers:
        if marker not in hld_text:
            fail(f"Required HLD invariant missing: {marker}")
    return len(required_interface_markers) + len(required_hld_markers)


def validate_roadmap_rules() -> int:
    text = DSHD_DESIGN_PATH.read_text(encoding="utf-8")
    required_markers = (
        "阶段 DAG 固定为 `M0 → M1 → M2 → M3 → {M4,M5,M6} → M7 → M8`",
        "建立 fake Harness、中央 reference stub、66-vector runner 和能力覆盖报告骨架",
        "完成并冻结 reference stub、66-vector runner、能力覆盖工具",
        "选择并冻结目标 ECS 环境清单",
        "M8 不开发产品功能或验收工具",
        "全部 `WUI-*` inventory/parity",
    )
    for marker in required_markers:
        if marker not in text:
            fail(f"Required roadmap gate missing: {marker}")
    stale_markers = (
        "M0 → M1 → M2/M3 → M4/M5/M6 → M7 → M8",
        "M8 目标环境压测后冻结",
    )
    for marker in stale_markers:
        if marker in text:
            fail(f"Stale roadmap rule remains: {marker}")
    return len(required_markers) + len(stale_markers)


def validate_trace_markers(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    used = set(re.findall(r"\[([A-Z]+-[0-9]+)\]", text))
    defined = set(re.findall(r"^\| \[([A-Z]+-[0-9]+)\] \|", text, re.MULTILINE))
    missing = used - defined
    if missing:
        fail(f"Undefined trace markers in {path.name}: {sorted(missing)}")
    return len(used)


def validate_local_links() -> int:
    checked = 0
    broken: list[str] = []
    for path in DOCS_DIR.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        for raw_target in re.findall(r"\[[^]]*\]\(([^)]+)\)", text):
            target = raw_target.split("#", 1)[0]
            if not target or re.match(r"https?://", target):
                continue
            linked = Path(target)
            if not linked.is_absolute():
                linked = path.parent / linked
            checked += 1
            if not linked.exists():
                broken.append(f"{path.name} -> {raw_target}")
    if broken:
        fail("Broken local Markdown links: " + "; ".join(broken))
    return checked


def validate_conformance_ids() -> int:
    text = CONFORMANCE_PATH.read_text(encoding="utf-8")
    groups = "|".join(EXPECTED_CONFORMANCE_RANGES)
    ids = re.findall(rf"^\| ((?:{groups})-[0-9]+) \|", text, re.MULTILINE)
    if len(ids) != len(set(ids)):
        fail("Duplicate conformance test IDs")
    expected = {
        f"{group}-{number:02d}"
        for group, last in EXPECTED_CONFORMANCE_RANGES.items()
        for number in range(1, last + 1)
    }
    actual = set(ids)
    if actual != expected:
        fail(
            "Conformance ID set drift: "
            f"missing={sorted(expected - actual)}, unexpected={sorted(actual - expected)}"
        )
    return len(ids)


def main() -> None:
    document, paths, schemas, refs = validate_openapi()
    protected_operations, mapped_responses = validate_response_contracts(document)
    example_values, positive_variants, negative_examples = validate_json_examples(document)
    operation_positive, operation_negative = validate_operation_variants(document, example_values)
    error_positive, error_negative = validate_error_response_schemas(document)
    (
        web_ui_capabilities,
        dshd_capabilities,
        excluded_capabilities,
        capability_evidence,
    ) = validate_capability_baseline()
    cross_contract_rules = validate_cross_contract_rules()
    roadmap_rules = validate_roadmap_rules()
    hld_markers = validate_trace_markers(HLD_PATH)
    interface_markers = validate_trace_markers(INTERFACE_PATH)
    links = validate_local_links()
    tests = validate_conformance_ids()
    print("Contract validation: PASS")
    print(f"OpenAPI: {paths} paths, {schemas} schemas, {refs} local refs")
    print(
        f"Examples: {len(example_values)} schema-validated JSON blocks; "
        f"{positive_variants} status variants accepted; "
        f"{negative_examples} status negatives rejected"
    )
    print(
        f"Operations: {operation_positive} state/type variants accepted; "
        f"{operation_negative} contradictory variants rejected"
    )
    print(
        f"Errors: {protected_operations} protected operations closed; "
        f"{mapped_responses} HTTP response mappings checked; "
        f"{error_positive} coded responses accepted; {error_negative} wrong-code cases rejected"
    )
    print(
        "Capabilities: "
        f"{web_ui_capabilities} Harness-owned Web UI parity targets (proxy-only); "
        f"{dshd_capabilities} dshd-owned features to implement; "
        f"{excluded_capabilities} MVP exclusions (no implementation); "
        f"{capability_evidence} evidence anchors"
    )
    print(f"Cross-contract invariants: {cross_contract_rules}")
    print(f"Roadmap gates: {roadmap_rules}")
    print(f"Trace markers: HLD={hld_markers}, interface={interface_markers}")
    print(f"Local links: {links}")
    print(f"Conformance specification: {tests} declared, 0 executed (implementation required)")


if __name__ == "__main__":
    main()
