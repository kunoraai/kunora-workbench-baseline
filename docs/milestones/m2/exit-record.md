# M2 出口记录（迭代 R4）

基线 `8bc882960b3a5a881dff17c4ed023174d1e34df1`；Rust/Cargo 1.89.0；Node 24.19.0；Harness frozen lock 与基线一致。runner：`declared=66 executed=4 passed=4 failed=0`。

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | BLOCKED-EXTERNAL | GitHub Actions 计费/runner 阻断尚未解除；本地七模式全绿仅作为补充，不能替代同一远端 run |
| AC-02 | PASS | `reports/t04-writer-guard.md`：内核锁、owner 生命周期及 successor 取得 |
| AC-03 | PASS | `reports/t14-real-harness.md`：干净检出构建及 dshd 产品路径两代真实认证/probe transcript |
| AC-04 | PASS | reducer 优先级/晚到 fence、durable desired、graceful stop 测试 |
| AC-05 | PASS | exact authority、redaction 与真实 exchange/probe |
| AC-06 | PASS | config/identity fail-closed tests |
| AC-07 | PASS | `reports/t15-runner.md`，66 声明保持 |
| VM-01 | BLOCKED-EXTERNAL | 无可引用的 GitHub Actions run/artifact；本地 structural/check/clippy/test/drift/selftests/evidence 全绿仅为补充 |
| VM-02 | PASS | `reports/t04-writer-guard.md` 的双 OS 进程 oracle 与 stale-owner successor 测试 |
| VM-03 | PASS | 同 AC-03；`node scripts/run-m2-real-harness.mjs` 的完整脱敏 transcript |
| VM-04 | PASS | runner 三种动态报告与 manifest 负测 |
| VM-05 | PASS | identity/state/persistence 正反测试及不可变 snapshot 订阅 |
| VM-06 | PASS | AC/VM 证据状态逐项诚实记录；外部阻断没有冒充 PASS |

环境注记（F07）：Windows 本机 Python 环境因缺少 `x86_64-cygwin` wheel，无法在临时 venv 安装锁定依赖。`validate_contracts.py` 的 10/42/66 复跑须在支持 wheel 的 CPython/CI 环境执行；此项记 `BLOCKED-ENV`，不记产品 FAIL，也不冒充 PASS。

未实施项：中央注册/心跳/租约客户端（M6）；管理 API 与 operation/idempotency（M3）；HTTP/WS 透明代理（M4/M5）；跨节点排他（部署层）；ST-02/09 等中央裁决场景。

除明确的 AC-01/VM-01 外部阻断和 F07 环境注记外，本地冻结出口证据支持：**“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”**。该结论仅覆盖 M2 本地进程管理与认证引导；`declared=66` 不表示 66 个向量全部执行。
