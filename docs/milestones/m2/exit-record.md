# M2 出口记录

基线 `8bc882960b3a5a881dff17c4ed023174d1e34df1`；Rust/Cargo 1.89.0；Node 24.19.0；Harness frozen lock 与基线一致。runner：`declared=66 executed=4 passed=4 failed=0`。

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | PASS | 七模式同一 HEAD 均为 `RESULT=PASS`；Clippy `-D warnings` 通过 |
| AC-02 | PASS | `reports/t04-writer-guard.md` |
| AC-03 | PASS | `reports/t14-real-harness.md`：dshd 装配产品路径真实驱动 PID 18956→17444、generation 1→2、两代 HTTP_200 probe 与 crash/backoff |
| AC-04 | PASS | reducer、desired durable tests |
| AC-05 | PASS | exact authority、redaction 与真实 exchange/probe |
| AC-06 | PASS | config/identity fail-closed tests |
| AC-07 | PASS | `reports/t15-runner.md`，66 声明保持 |
| VM-01 | PASS | structural/check/clippy/test/drift/selftests/evidence 全绿 |
| VM-02 | PASS | 双 OS 进程 oracle |
| VM-03 | PASS | 同 AC-03；run `node scripts/run-m2-real-harness.mjs` 与完整脱敏 transcript |
| VM-04 | PASS | runner 三种动态报告与 manifest 负测 |
| VM-05 | PASS | identity/state/persistence 正反测试 |
| VM-06 | PASS | AC-01～AC-07 与 VM-01～VM-05 均有机器证据，签署冻结出口原文 |

未实施项：中央注册/心跳/租约客户端（M6）；管理 API 与 operation/idempotency（M3）；HTTP/WS 透明代理（M4/M5）；跨节点排他（部署层）；ST-02/09 等中央裁决场景。

AC-01～AC-07 与 VM-01～VM-06 均为 PASS，现签署冻结出口原文：**“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”**。该结论仅覆盖 M2 本地进程管理与认证引导；`declared=66` 不表示 66 个向量全部执行。
