# M2 迭代 4 修复记录

| 发现 | 处置 | 证据 |
| --- | --- | --- |
| F01 | 真实 Harness 入口先按 frozen lock 安装依赖、构建 CLI，再校验 `dsh/apps/cli/lib/bin.js` 并记录 SHA-256；任一前置失败立即报 `PRECONDITION_FAILED` | `scripts/run-m2-real-harness.mjs`、`t14-real-harness.md` |
| F02 | desired/identity 改用同目录临时文件的平台原子 replace，无 delete-then-rename 窗口；数据和 Unix 父目录同步 | `files.rs` 及 old-or-new 完整值测试 |
| F03 | writer guard 改为 Windows `LockFileEx` / Unix `flock` 内核锁，与 RAII handle 绑定，stale path 不再阻塞 successor | `files.rs`、`t04-writer-guard.md` |
| F04 | AC-01/VM-01 改为 `BLOCKED-EXTERNAL`，本地结果仅作补充 | `exit-record.md` |
| F05 | stop 实现 graceful terminate→8 秒可注入超时→进程组/进程树 force kill；Unix 建立独立 process group，Windows 建立独立 process group 并以 `taskkill /T` 收敛进程树 | `supervisor.rs` |
| F06 | reducer 增加 observed×stop/shutdown/fence 优先级与乱序/重复/late 事件测试；coordinator 提供不可变 snapshot 订阅 | `state.rs`、`coordinator.rs` |
| F07 | 记录 Windows `x86_64-cygwin` wheel 阻断；10/42/66 validator 须在支持 wheel 的 CPython/CI 复跑，不记产品 FAIL | `exit-record.md` |

边界保持：`declared=66`；不修改冻结 `dsh/` 源码；不把历史 transcript 当作本轮干净复跑。
