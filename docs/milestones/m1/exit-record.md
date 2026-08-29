# M1 出口记录骨架

状态口径：本地机器证据填入；必须由远端 CI 或 Docker 产生的证据为 `PENDING`。

| ID | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | PENDING | 新 clone CI 同一次 run（未推送） |
| AC-02 | PASS | `dshd-contract/tests/drift_gate.rs` 正负测试 |
| AC-03 | PENDING | CI 中的 `validate_contracts.py` 日志 |
| AC-04 | PENDING | 无本地 Docker，等待 CI build/smoke |
| AC-05 | PASS | Rust 1.89.0 与 `scripts/release-manifest.ps1` |
| AC-06 | PASS | 四工具版本/自检；`declared=66, executed=0` |
| AC-07 | PASS | baseline diff：冻结输入、`dsh/`、`docs/contracts/` 零修改 |
| VM-01 | PENDING | 新 clone/无缓存 CI |
| VM-02 | PENDING | CI 契约验证器机器日志 |
| VM-03 | PASS | 四资产本地 `--version`/`--self-test` |
| VM-04 | PENDING | Docker skeleton CI smoke |
| VM-05 | PASS | 冻结边界、Rust 与 lock 摘要审查 |
| VM-06 | PASS | 本出口索引及诚实声明 |

诚实声明：M1 未实现或验收任何 dshd 业务行为；runner 仅声明清单，结果为 `declared=66, executed=0`；fake Harness 与 reference stub 自检不等于产品行为通过；没有 `WUI-*` parity 双证据；目标 ECS、候选 digest 与真实 Docker 证据仍为 `PENDING`。

