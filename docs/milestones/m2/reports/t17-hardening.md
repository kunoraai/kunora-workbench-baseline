# T17 强化证据

- 双进程：writer guard 使用 owner-bound OS 内核锁；竞争者 `WRITER_GUARD_HELD`，owner 崩溃后 successor 不受 stale 文件阻塞。
- 原子文件：desired RUNNING→STOPPED 使用同目录原子 replace，无删除窗口；重读只得到完整旧值或新值；损坏 schema fail-closed。
- 竞态：优先级为 fence > shutdown > desired-stop > 普通 observed 后果；晚到、重复、乱序 attempt completion 不发布 context。
- 观测：coordinator 提供不可变 snapshot subscription；关闭/慢消费者不阻塞 reducer。
- 停止：独立 process group，graceful terminate→8 秒可注入 timeout→进程树强杀。
- 停止竞态：Stop effect 不阻塞 reducer；child monitor 与 stop worker 只短时持有 child handle 锁。child-exit/shutdown 两种顺序均有确定性回归，重复 shutdown 被 reducer 去重。
- authority：只接受 `127.0.0.1` exact authority；`localhost` 负例拒绝。
- secret：Secret 的 Debug 固定为 `[REDACTED]`；报告仅记录脱敏 authority/cookie 数量。
- `cargo test --workspace --locked`：PASS。

真实 Harness crash N+1 强化循环已在干净检出复跑，见 T14。

2026-08-30 真实双进程 CF-01：owner PID 11520 持 guard、spawn child PID 12340 并达到 READY generation 1；competitor PID 8636 exit=1，仅 stderr `WRITER_GUARD_HELD`，无 Spawn/Ready/local 副作用。owner 的 hold deadline 随后经历 graceful→8000ms→force，发布 Stopped 并自行 exit=0。另一 owner 竞态运行先强制结束第一代 child，再恢复第二代并由 hold deadline 稳定收敛，见 T08。
