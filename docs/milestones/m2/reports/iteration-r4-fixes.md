# M2 独立验收 R1 修复记录（迭代 R4）

| 发现 | 处置 | 验证 |
| --- | --- | --- |
| F01 | 产品脚本先执行 frozen-lock pnpm install/build，校验 `apps/cli/lib/bin.js` 并记录 SHA-256；再 `cargo build --locked -p dshd`。缺产物时以 `PRECONDITION_FAILED` fail-fast。 | `t14-real-harness.md` 保存干净工作树、新临时 HOME/state 的两代 transcript。 |
| F02 | identity/desired 通过同目录 `atomicwrites` 原子提交；desired 允许原子覆盖，identity 使用 `DisallowOverwrite` 保持 create-if-absent，无 delete 窗口。 | durable/完整旧值或新值及并发创建语义测试。 |
| F03 | writer guard 改为 Windows `LockFileEx` / Unix `flock` 的 RAII 内核锁；stale 文件不再代表 ownership。 | 排他、释放、stale-owner successor 与 CF-01 报告。 |
| F04 | AC-01/VM-01 改为 `BLOCKED-EXTERNAL`，本地七模式仅列补充。 | `exit-record.md`。 |
| F05 | child 使用独立 process group；stop 先 graceful terminate，再等待默认 8 秒，超时后强杀进程树；timeout 可注入。 | stop timeout 单测与 supervisor 日志 phase。 |
| F06 | reducer 增加 fence > shutdown > desired-stop 的本地后果优先级、晚到/重复/乱序终态保护；coordinator 提供不可变 snapshot 订阅并剔除慢/关闭订阅者。 | core/adapters 新增模型测试。 |
| F07 | 如实记录本机 cygwin wheel 阻断，要求在支持 wheel 的 CPython/CI 重跑 10/42/66。 | `exit-record.md`；不记产品 FAIL/PASS。 |

范围保持 M2 R1 修复，`declared=66` 不变，冻结 `dsh/` 源码未修改。
