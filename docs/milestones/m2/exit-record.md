# M2 出口记录

基线 `8bc882960b3a5a881dff17c4ed023174d1e34df1`；Rust/Cargo 1.89.0；Node 24.19.0；Harness frozen lock 与基线一致。runner：`declared=66 executed=4 passed=4 failed=0`。

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| AC-01 | PASS | 七模式同一 HEAD 均为 `RESULT=PASS`；Clippy `-D warnings` 通过 |
| AC-02 | PASS | `reports/t04-writer-guard.md` |
| AC-03 | BLOCKED | `reports/t14-real-harness.md`：真实两代诊断链 PASS；dshd 未装配 supervisor/effect executor，尚无 dshd 自动 crash→N+1 transcript |
| AC-04 | PASS | reducer、desired durable tests |
| AC-05 | PASS | exact authority、redaction 与真实 exchange/probe |
| AC-06 | PASS | config/identity fail-closed tests |
| AC-07 | PASS | `reports/t15-runner.md`，66 声明保持 |
| VM-01 | PASS | structural/check/clippy/test/drift/selftests/evidence 全绿 |
| VM-02 | PASS | 双 OS 进程 oracle |
| VM-03 | BLOCKED | 同 AC-03；PID 6800→10440、generation 1→2 是诊断 driver 证据，不冒充产品自动恢复 |
| VM-04 | PASS | runner 三种动态报告与 manifest 负测 |
| VM-05 | PASS | identity/state/persistence 正反测试 |
| VM-06 | BLOCKED | AC-03 未闭合，不能签署出口原文 |

未实施项：中央注册/心跳/租约客户端（M6）；管理 API 与 operation/idempotency（M3）；HTTP/WS 透明代理（M4/M5）；跨节点排他（部署层）；ST-02/09 等中央裁决场景。

由于 AC-03/VM-03 尚 BLOCKED，本记录不宣称 M2 总出口通过，也不把 fake、unit 或外部诊断 driver 证据冒充 dshd 的真实 Harness crash recovery。阻塞原因已由本轮从“环境语义不明”收敛为产品装配缺失：`dshd` 运行路径尚未执行 supervisor/reducer effects；下一步是完成装配后重跑 T14。
