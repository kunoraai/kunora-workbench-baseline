# M1 出口记录骨架

状态口径：本地机器证据填入；必须由远端 CI 或 Docker 产生的证据为 `PENDING`。

本地候选提交：`f0ea8237d2a9a1057276189635682d213baf5a87`。本地验收 run：2026-08-29 五模式连续执行，均输出 `RESULT=PASS`；原始输出保留于任务执行记录。工具链为 `rustc 1.89.0 (29483883e 2025-08-04)`、`cargo 1.89.0 (c24e10642 2025-06-23)`；`Cargo.lock` SHA-256 为 `f091069863a575e0f7b2e09a70c20f9f631db36ce2b07bd6f5c22a286ec96111`，`rust-toolchain.toml` SHA-256 为 `4162448befdeae7c7c6db340df4e5b1fefa795ff6554d6c28ce952e3b05e5dd3`，Harness lock SHA-256 为 `506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1`。

原始 artifact 索引：生成物位于 `crates/dshd-contract/src/generated/`；66-vector manifest 为 `tools/conformance-runner/vectors.csv`；能力 inventory 为 `tools/capability-report/inventory.csv`；逐发现处置为 `docs/milestones/m1/reports/iteration-r2-fixes.md`。远端 CI run URL/ID、Docker image ID/build log 因未推送且本机无 Docker，明确留空并保持 PENDING。

| ID | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | PENDING | 新 clone CI 同一次 run（未推送） |
| AC-02 | PASS | `contract-gen --check` 零 drift；机械验收损毁生成物后非零、恢复后归零 |
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
