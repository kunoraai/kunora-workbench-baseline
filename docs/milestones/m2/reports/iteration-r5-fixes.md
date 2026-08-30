# M2 迭代 5 修复记录

| 发现 | 处置 | 本轮证据 |
| --- | --- | --- |
| F05/F09 | coordinator 不再同步执行最长 8 秒的 Stop effect；supervisor 在独立线程完成 graceful/force/wait，child monitor 可并发发布退出。reducer 在停止意图成立时将 `ChildExited` 直接收敛为终态，并对重复 shutdown 去重；hold deadline 只投递一次 shutdown。typed stop、hold deadline、OS termination signal 共用 `Event::Shutdown`。 | `state.rs` 的 child-gone-before-stop-event、stop-event-before-child-gone、duplicate-shutdown 三项确定性测试；T08/T17 的真实 owner 与 CF-01 记录。 |
| F07 | 原生 Windows Python 3.12 venv 可创建并安装锁定的 `openapi-spec-validator==0.7.1`、`PyYAML==6.0.2`、`jsonschema==4.26.0`。R1 的 Cygwin wheel 环境归因不成立；R2 失败的真实原因是 F08 文档断链。 | 临时原生 venv 执行 validator exit=0：`Contract validation: PASS`，10 paths、42 schemas、66 declared、0 executed。 |
| F08 | 调用方提交 `64b90c5f` 已修复 13 个相对链接；本轮不改冻结计划。 | 同一原生 venv validator 输出 174 local links 且 exit=0。 |

边界保持：`declared=66` 不变；AC-01/VM-01 继续 `BLOCKED-EXTERNAL`；未用历史 transcript 代替本轮复跑；未修改冻结语义或检查器。
