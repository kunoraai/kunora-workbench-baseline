# M2 出口记录（迭代 5）

基线 `8bc882960b3a5a881dff17c4ed023174d1e34df1`；Rust/Cargo 1.89.0；Node 24.19.0；Harness frozen lock 与基线一致。runner：`declared=66 executed=4 passed=4 failed=0`。

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | BLOCKED-EXTERNAL | GitHub Actions 计费/runner 阻断未解除；本地七模式仅作补充证据，不冒充远程 CI |
| AC-02 | PASS | `reports/t04-writer-guard.md`：OS 内核锁、owner 生命周期与 successor 重取 |
| AC-03 | PASS | `reports/t14-real-harness.md`：干净检出可重复构建与 dshd 产品路径两代 transcript |
| AC-04 | PASS | reducer 两种 child-exit/shutdown 顺序与重复 shutdown 测试；typed stop、hold deadline owner 均有界 STOPPED |
| AC-05 | PASS | exact authority、redaction 与真实 exchange/probe |
| AC-06 | PASS | config/identity fail-closed tests |
| AC-07 | PASS | `reports/t15-runner.md`，`declared=66` 保持 |
| VM-01 | BLOCKED-EXTERNAL | 无同一 commit 的远程 GitHub Actions run/artifact；本地机械验收只作补充 |
| VM-02 | PASS | `reports/t04-writer-guard.md`、`reports/t17-hardening.md`；本轮 owner PID 11520 与 competitor PID 8636 的真实 OS 锁竞争 |
| VM-03 | PASS | 同 AC-03；提交 `cadb8e0` 的新 detached worktree 完整脱敏 transcript |
| VM-04 | PASS | runner 动态报告与 manifest 负测 |
| VM-05 | PASS | identity/state/persistence 正反测试与 F09 两序/重复 shutdown 回归 |
| VM-06 | BLOCKED-EXTERNAL | AC-01/VM-01 的远程 CI 证据仍受外部阻断，不签署“全部门禁 PASS” |

原生 Windows Python 3.12 临时 venv 已安装锁定的 openapi-spec-validator 0.7.1、PyYAML 6.0.2、jsonschema 4.26.0；`validate_contracts.py` exit=0，输出 `Contract validation: PASS`、10 paths、42 schemas、179 local refs、66 declared、0 executed。R1 的 Cygwin wheel 环境归因不成立；R2 失败实因是 F08 断链，调用方提交 `64b90c5f` 修复后本轮复跑全绿。

未实施项：中央注册/心跳/租约客户端（M6）；管理 API 与 operation/idempotency（M3）；HTTP/WS 透明代理（M4/M5）；跨节点排他（部署层）；ST-02/09 等中央裁决场景。
