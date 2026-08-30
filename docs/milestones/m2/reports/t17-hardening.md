# T17 强化证据

- 双进程：PID 17396/11044，竞争者 `WRITER_GUARD_HELD`。
- 原子文件：desired RUNNING→STOPPED→重读完整；损坏 schema fail-closed。
- 竞态：晚到 attempt completion 不发布 context；shutdown 后认证成功不复活。
- authority：只接受 `127.0.0.1` exact authority；`localhost` 负例拒绝。
- secret：Secret 的 Debug 固定为 `[REDACTED]`；报告仅记录脱敏 authority/cookie 数量。
- `cargo test --workspace --locked`：PASS。

真实 Harness crash N+1 强化循环仍 BLOCKED，见 T14。
