# M2 出口记录（迭代 4）

基线 `8bc882960b3a5a881dff17c4ed023174d1e34df1`；Rust/Cargo 1.89.0；Node 24.19.0；Harness frozen lock 与基线一致。runner：`declared=66 executed=4 passed=4 failed=0`。

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | BLOCKED-EXTERNAL | GitHub Actions 计费/runner 阻断未解除；本地七模式仅作补充证据，不冒充远程 CI |
| AC-02 | PASS | `reports/t04-writer-guard.md`：OS 内核锁、owner 生命周期与 successor 重取 |
| AC-03 | PASS | `reports/t14-real-harness.md`：干净检出可重复构建与 dshd 产品路径两代 transcript |
| AC-04 | PASS | reducer 优先级/late fence 模型测试、snapshot 订阅、desired durable tests |
| AC-05 | PASS | exact authority、redaction 与真实 exchange/probe |
| AC-06 | PASS | config/identity fail-closed tests |
| AC-07 | PASS | `reports/t15-runner.md`，`declared=66` 保持 |
| VM-01 | BLOCKED-EXTERNAL | 无同一 commit 的远程 GitHub Actions run/artifact；本地机械验收只作补充 |
| VM-02 | PASS | `reports/t04-writer-guard.md`；真实 OS 锁竞争与 owner 退出后 successor 取得 |
| VM-03 | PASS | 同 AC-03；`node scripts/run-m2-real-harness.mjs` 的完整脱敏 transcript |
| VM-04 | PASS | runner 动态报告与 manifest 负测 |
| VM-05 | PASS | identity/state/persistence 正反测试 |
| VM-06 | BLOCKED-EXTERNAL | AC-01/VM-01 的远程 CI 证据仍受外部阻断，不签署“全部门禁 PASS” |

Windows 本机 Python 环境因 `x86_64-cygwin` wheel 缺失，无法在临时 venv 安装锁定依赖。`validate_contracts.py` 的 10/42/66 复跑须在支持相应 wheel 的 CPython/CI 环境执行；该项记为环境阻断，不记产品 FAIL，也不记 PASS。

未实施项：中央注册/心跳/租约客户端（M6）；管理 API 与 operation/idempotency（M3）；HTTP/WS 透明代理（M4/M5）；跨节点排他（部署层）；ST-02/09 等中央裁决场景。
