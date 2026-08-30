# M2 出口记录

基线 `8bc882960b3a5a881dff17c4ed023174d1e34df1`；Rust/Cargo 1.89.0；Node 24.19.0；Harness frozen lock 与基线一致。runner：`declared=66 executed=4 passed=4 failed=0`。

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | PASS | 七模式同一 HEAD 均为 `RESULT=PASS`；Clippy `-D warnings` 通过 |
| AC-02 | PASS | `reports/t04-writer-guard.md` |
| AC-03 | BLOCKED | 真实启动/auth/probe PASS；真实 crash→N+1 transcript 缺失 |
| AC-04 | PASS | reducer、desired durable tests |
| AC-05 | PASS | exact authority、redaction 与真实 exchange/probe |
| AC-06 | PASS | config/identity fail-closed tests |
| AC-07 | PASS | `reports/t15-runner.md`，66 声明保持 |
| VM-01 | PASS | structural/check/clippy/test/drift/selftests/evidence 全绿 |
| VM-02 | PASS | 双 OS 进程 oracle |
| VM-03 | BLOCKED | 同 AC-03 |
| VM-04 | PASS | runner 三种动态报告与 manifest 负测 |
| VM-05 | PASS | identity/state/persistence 正反测试 |
| VM-06 | BLOCKED | AC-03 未闭合，不能签署出口原文 |

未实施项：中央注册/心跳/租约客户端（M6）；管理 API 与 operation/idempotency（M3）；HTTP/WS 透明代理（M4/M5）；跨节点排他（部署层）；ST-02/09 等中央裁决场景。

由于 AC-03/VM-03 尚 BLOCKED，本记录不宣称 M2 总出口通过，也不把 fake 或 unit 证据冒充真实 Harness crash recovery。
