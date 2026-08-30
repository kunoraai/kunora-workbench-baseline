# M2「进程与认证」第三轮独立验收报告（R3）

## 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| R3 | 2026-08-30 | Remote Agent | 独立阅读冻结输入、R1/R2 与迭代 5 实现；在原生 Windows、临时 venv、新 detached worktree 和隔离 HOME/状态下重跑门禁、两轮两代真实产品链、三轮停止收敛及 CF-01，并重估 F01～F09。 | `PROMPT.md`、M2 frozen 文档、中央一致性契约、Harness 冻结基线、本轮真实输出 |

## 1. 总体结论

总体结论：有条件通过

迭代 5 对本轮要求复核的 F05、F07、F08、F09 均已提供可重复的代码与运行证据，R1/R2 已修复的 F01～F04、F06 未回退。尤其是 R2 的决定性停止竞态没有重现：两轮干净产品链和三轮独立 hold-deadline/ignore-termination owner 循环均发布 STOPPED，child 与 dshd 自身均在外层预算内消失；reducer 对 child-gone 先、stop 先与重复 shutdown 的测试也全部通过。原生 Windows Python 3.12 venv 中契约验证真实 exit=0，F08 的 13 个断链已修复，输出为 10 paths、42 schemas、174 local links、66 declared、0 executed。

本报告仍保留一个既有外部条件：AC-01/VM-01 所需同一 commit 的 GitHub Actions 单次全绿及 artifact 继续受账户计费/runner 阻断，故只能记 `BLOCKED-EXTERNAL`。这不是迭代 5 的代码失败，也不能被本地全绿冒充。因此四维度结论为：阶段目标达成 **PASS（CI 外部条件保留）**；交付物与计划符合度 **PASS**；代码评审 **PASS（Windows 树所有权按源码表述）**；真实测试复跑 **PASS**。在远端 CI 条件解除前采用“有条件通过”，解除后只需补远端证据，不应重写本轮真实测试事实。

## 2. AC/VM 重估表

| 项目 | R3 独立证据 | 结论 |
| --- | --- | --- |
| AC-01 | 本轮本地 `cargo check/test/clippy/fmt`、R5 drift/selftests 和 validator 全绿；但没有同一 commit 的 GitHub Actions run/artifact，且既有记录表明账户计费/runner 外阻未解除。 | BLOCKED-EXTERNAL |
| AC-02 | 新 worktree CF-01：owner PID 15016 持 LockFileEx 对应的 OS 锁并启动 child PID 14824 至 READY；competitor PID 16800 在 10 秒内退出，仅 stderr `WRITER_GUARD_HELD`，无 guard/Spawn/Ready 副作用；owner 最终 STOPPED、child gone、daemon exited。Unix 依赖映射仍为 flock。 | PASS |
| AC-03 | 新 detached worktree、隔离 HOME/USERPROFILE/XDG/DSH 状态连续两轮：第一轮 PID 14204→17244，第二轮 PID 18456→6548；两轮均 generation 1→2、两代 exchange=303/probe=HTTP_200、crash→1000ms backoff→N+1，最后 STOPPED。 | PASS |
| AC-04 | 双产品链 typed shutdown 均由 STOPPING sequence 10 收敛到 STOPPED sequence 12；三轮 hold deadline 均由 READY→STOPPING→STOPPED，最大 sequence=7；desired 保留，重复 shutdown unit 不产生第二个 Stop effect。 | PASS |
| AC-05 | 两轮真实链均只使用 `127.0.0.1:<dynamic>` exact authority，exchange=303 后 probe=HTTP_200，再发布 READY；token/cookie 均为 REDACTED，未落盘。 | PASS |
| AC-06 | config/identity 正反测试和 main 装配顺序继续通过；无效输入在 guard/supervisor 前 fail-closed。 | PASS |
| AC-07 | conformance-runner 本轮输出 `declared=66 executed=4 passed=4 failed=0 driver=m2-local`，没有把 62 个未执行向量写成通过。 | PASS |
| VM-01 | 本地证据完整，但远端 GitHub Actions 单次运行仍不可得。 | BLOCKED-EXTERNAL |
| VM-02 | CF-01 双 OS 进程 oracle 完整：owner 有真实 child/READY，competitor 无副作用并得到规定错误，owner shutdown 后锁与进程树收敛。 | PASS |
| VM-03 | 两次新检出真实 Harness 产品路径均从 frozen install/build、bin.js digest 开始，不复用历史 transcript；两代 PID、generation、认证、probe、恢复和停止齐全。 | PASS |
| VM-04 | runner self-test 与 R5 selftests-real 一致，动态计数 `executed=4`，总声明保持 66。 | PASS |
| VM-05 | 原子 replace、OS lock、late/duplicate/out-of-order、两种停止事件顺序、snapshot subscription、三轮 ignore-termination 黑盒均通过；validator 也全绿。 | PASS |
| VM-06 | 冻结路线图原文出口“可靠管理并连接真实 Harness；相关 runner 场景可执行”已由本轮产品链和 runner 重现；只保留 VM-01 外部 CI 条件。 | PASS（外部条件见 VM-01） |

## 3. F01～F09 处置对质

| 发现 | R3 状态 | 独立对质证据 |
| --- | --- | --- |
| F01 | FIXED | 新 detached worktree 起初没有历史构建产物；脚本真实执行 corepack pnpm frozen-lock install、pnpm build，生成 `dsh/apps/cli/lib/bin.js`，两轮 SHA-256 均为 `dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166`，随后两代产品链均 PASS。 |
| F02 | FIXED | `AtomicFile` 的 AllowOverwrite/DisallowOverwrite 路径仍无 delete-then-rename 窗口；`replacement_is_always_a_complete_old_or_new_value` 与 durable desired 测试通过。 |
| F03 | FIXED | WriterGuard 继续持有 fs4 内核锁的 File handle；Windows 对应 LockFileEx，Unix 对应 flock。真实 CF-01 证明竞争者无副作用，owner 结束后不遗留基于 sentinel 的永久占用语义。 |
| F04 | FIXED | `exit-record.md` 继续将 AC-01/VM-01 记为 BLOCKED-EXTERNAL，没有用本地 cargo 或 validator 结果冒充远端 CI。 |
| F05 | FIXED | 两轮 typed shutdown 与三轮 hold deadline/ignore-termination 均先 graceful，8 秒后 `timeout-force-kill`，child gone、STOPPED、daemon exited。源码 stop timeout=8s，Windows 使用进程组+`taskkill /T`/`/F`+精确 Child handle，Unix 使用独立 process group TERM/KILL。 |
| F06 | FIXED | core 12 tests 全绿；priority、late、duplicate、out-of-order、terminal no-revive 与不可变 snapshot subscription 均继续存在。本轮未发现 reducer/snapshot 回退。 |
| F07 | FIXED | 原生 `C:\Program Files\Python312\python.exe` 成功创建 venv 并安装锁定依赖；validator exit=0。R1 的 Cygwin wheel 归因已由 exit-record/迭代报告更正，R2 的真实失败被准确归因为当时的 F08。 |
| F08 | FIXED | 原生 venv 的 `validate_contracts.py` 输出 `Contract validation: PASS`、10 paths、42 schemas、179 local refs、Local links: 174、Conformance 66 declared/0 executed。修复没有通过放宽 validator 隐藏断链。 |
| F09 | FIXED | supervisor 的 Stop effect 在独立线程运行，避免 coordinator 被 8 秒等待占住；monitor 与 stop 可并发。两种事件顺序和重复 shutdown unit 全绿；本轮 2+3 个真实停止样本全部有界收敛，无 sequence 风暴，未重现 R2 的 85 秒 STOPPING 残留。 |

## 4. 维度一：阶段目标达成

阶段目标已在本地独立环境达成。真实 Harness 不是 fake-harness：产品脚本装配真实 dshd、冻结 Node CLI、ready URL、cookie exchange 与 probe。两轮均观察到不同的一代/二代 PID、generation 1→2、crash 后 1000ms 退避以及 N+1 READY。停止路径在 typed command 和 hold deadline 两个入口复用 Event::Shutdown，最后由同一 reducer 发布 STOPPED。

远端 CI 的 BLOCKED-EXTERNAL 不改变产品链事实，但阻止将 AC-01/VM-01 写成 PASS。这是“有条件通过”而非“未通过”的唯一原因；条件内容明确、外部且不会掩盖任何本轮失败。

## 5. 维度二：交付物与计划符合度

### 5.1 T01～T18 核验

| 任务 | R3 结论与证据 |
| --- | --- |
| T01 | PASS：冻结 tag/commit/tree/lock、Node/pnpm 与 M2 输入保持可追踪；两轮构建得到相同 bin.js digest。 |
| T02 | PASS：config、identity、exact authority、Secret redaction unit 全绿。 |
| T03 | PASS：identity create-if-absent 与 desired 原子 replacement/durable 测试无回退。 |
| T04 | PASS：CF-01 完整双进程实测，Windows LockFileEx/Unix flock 声明与 fs4 依赖一致。 |
| T05 | PASS：单 reducer 的优先级、late、duplicate、out-of-order、shutdown 双序测试执行。 |
| T06 | PASS：coordinator 串行归约并发布 immutable snapshot；closed/slow watcher 不阻塞。 |
| T07 | PASS：spawn、child monitor、1/2/4…30 秒 backoff、graceful→8s→force 和进程树停止均有代码与黑盒证据。 |
| T08 | PASS：两轮 crash→backoff→N+1，三轮 hold deadline，双事件顺序与重复 shutdown 均收敛。 |
| T09 | PASS：ReadyUrl 只接受 exact loopback authority；localhost 负例继续通过。 |
| T10 | PASS：真实链两代均 exchange=303、probe=HTTP_200 后才 READY；cookie/token 仅内存且 REDACTED。 |
| T11 | PASS：fake-harness 连续两次 SELF_TEST=PASS，八类 fixture 完整，vectors_executed=0。 |
| T12 | PASS：reference-stub 连续两次 PASS，route_probe=13/13，behavior=NOT_IMPLEMENTED，未冒充 M6。 |
| T13 | PASS：main 继续按 config→identity→desired→guard→coordinator→supervisor 装配；ctrlc、typed command、hold deadline 共用 shutdown event。 |
| T14 | PASS：新检出两轮冻结真实 Harness 全链 PASS，非历史 transcript。 |
| T15 | PASS：runner `declared=66 executed=4 passed=4 failed=0`，计数诚实。 |
| T16 | PASS（本地）/BLOCKED-EXTERNAL（远端）：Rust、R5 checker、validator 均通过；远端 CI 账户条件未解除。 |
| T17 | PASS：原子、OS 锁、secret、双序竞态、三轮 ignore-termination 强化均有本轮证据。 |
| T18 | PASS（本地出口）：所有要求复跑门禁全绿，exit record 口径诚实；远端 artifact 条件单独保留。 |

### 5.2 D1～D9 核验

| 交付物 | 状态 | 说明 |
| --- | --- | --- |
| D1 | PASS | 配置与身份规则、持久化、mismatch/fail-closed 成立。 |
| D2 | PASS | 原子 desired/identity 与真实 OS writer guard 成立，CF-01 通过。 |
| D3 | PASS | 单 reducer、typed Event/Effect、优先级、双序和 snapshot subscription 成立。 |
| D4 | PASS | supervisor 的 crash recovery、backoff、generation 与所有抽样停止路径稳定收敛。 |
| D5 | PASS | exact authority、exchange、probe、内存 cookie 与 probe 后 READY 在两轮真实链重现。 |
| D6 | PASS | 冻结真实 Harness 在新 worktree 可重复构建并被产品装配，两轮摘要一致。 |
| D7 | PASS | fake/stub 连续自检稳定且明确 vectors_executed=0/NOT_IMPLEMENTED。 |
| D8 | PASS | runner 保持 66 declared，只有四个本地 driver 计 executed。 |
| D9 | PASS（本地） | 报告、exit record、validator 与本轮 artifact 口径一致；远端 CI artifact 为外部条件。 |

## 6. 维度三：代码评审

### 6.1 supervisor shutdown、monitor 与树所有权

迭代 5 的关键变化有效：`Effect::Stop` 不再在 coordinator effect loop 内同步等待，而是 clone supervisor 后新建线程执行 stop。child monitor 也在独立线程中以 50ms 间隔 `try_wait`。两者共享同一个 `Arc<Mutex<Child>>`，但 Stop 从 children map remove 不会销毁 monitor 的 Arc；monitor 的单次锁只包围非阻塞 `try_wait`，Stop 的 signal/deadline/wait 可以推进。无论 monitor 先发 ChildExited，还是 stop 线程先发 Stopped，reducer 都有显式终态规则。

Windows 源码没有 job object，故本报告不重复实现方早期“job object”误称。实际等价树策略是 `CREATE_NEW_PROCESS_GROUP`、graceful `taskkill /PID <pid> /T`、8 秒后 `taskkill /T /F`，并对精确 Child handle 再 kill/wait；Unix 是独立 process group 和负 PGID 的 TERM/KILL。三轮真实 Harness 忽略 graceful 后仍由 force 阶段清除整棵树，说明当前声明与源码、黑盒事实一致。job object 在更复杂的孙进程逃逸模型下仍可作为未来强化，但不是本轮未满足项。

### 6.2 reducer 与 shutdown 入口

`Event::Shutdown` 首次设置 shutdown 后产生一个 Stop effect；重复事件不再增加 effect。child-gone-before-stop-event 先到 Unhealthy，再收到 shutdown 并由 Stopped acknowledgement 收敛；stop-event-before-child-gone 在 Stopping 收到 ChildExited 后直接进入 Stopped。late/duplicate/out-of-order 事件不能复活 terminal state。main 的 ctrlc handler、stdin `shutdown` 与一次性 hold deadline 都只发送相同事件；deadline 触发后被置 None，避免每 20ms 重发形成 sequence 风暴。

### 6.3 持久化、锁、认证与边界

AtomicFile 继续使用同目录原子提交而非 remove+rename；WriterGuard 的 File RAII handle 持有 fs4 锁，锁文件存在与锁占用被正确区分。认证只保留 exact authority 与 Secret cookie；日志输出 REDACTED。core 没有 OS/网络副作用，adapter 承担文件、锁、进程和 HTTP，main 只装配，没有出现第二套 reducer、DTO、错误码或向量 manifest。

## 7. 维度四：真实测试复跑记录

以下为本评审亲自执行的有效运行。冷 Rust 构建的首次工具窗口结束后遗留编译进程造成 build lock；清理本轮遗留测试进程、完成缓存后重新执行了带明确退出码的完整命令。该准备噪声不计产品失败或通过。另有一次 hold 探针因含空格 Node 路径被 Start-Process 拆分而没有 spawn，已明确判无效并未计入三轮结果。

| 命令/场景 | 真实输出摘要 | 判定 |
| --- | --- | --- |
| `cargo check --workspace --all-targets --locked` | `Finished dev profile`，`CHECK_EXIT=0`。 | PASS |
| `cargo test --workspace --locked` | adapters 9、core 12、contract/tools/doc tests 全绿；drift test `RESULT=PASS ZERO_DRIFT files=4`。 | PASS |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | 无 warning，exit=0。 | PASS |
| `cargo fmt --all -- --check` | 无格式差异，exit=0；fmt 本身无 `--locked` 参数。 | PASS |
| `node tools/check-m2-impl-r5.mjs --mode drift-real` | `RESULT=PASS MODE=drift-real`，含损毁负向门及恢复。 | PASS |
| `node tools/check-m2-impl-r5.mjs --mode selftests-real` | `RESULT=PASS MODE=selftests-real`；仅 Node DEP0190 提示。 | PASS |
| fake-harness `--self-test` ×2 | 两次 SELF_TEST=PASS；ready/cookie/probe/crash/hang 八类 fixture；vectors_executed=0。 | PASS×2 |
| reference-stub `--self-test` ×2 | 两次 PASS；route_probe=13/13，behavior=NOT_IMPLEMENTED，STALE_INSTANCE/FENCED/unreachable。 | PASS×2 |
| conformance-runner `--self-test` | `declared=66 executed=4 passed=4 failed=0 driver=m2-local`。 | PASS |
| 原生 Python 3.12 venv `validate_contracts.py` | 锁定依赖安装成功；`Contract validation: PASS`；10 paths、42 schemas、179 refs、174 links、66 declared、0 executed。 | exit=0 PASS |
| 新 worktree 产品链第 1 轮 | bin.js digest `dc23...3166`；PID 14204→17244；generation 1→2；exchange=303/probe=HTTP_200；crash→1000ms backoff；graceful→8s force；sequence 10→12；STOPPED。 | PASS |
| 新 worktree 产品链第 2 轮 | 同一 bin.js digest；PID 18456→6548；generation 1→2；两代认证/probe、backoff、STOPPING/STOPPED、daemon exit 全部重现。 | PASS |
| hold/ignore-termination 第 1 轮 | READY；child PID 5460；graceful 后 force；max sequence=7；child_gone=true、STOPPED=true、daemon_exited=true。 | PASS |
| hold/ignore-termination 第 2 轮 | READY；child PID 17592；graceful 后 force；max sequence=7；child_gone=true、STOPPED=true、daemon_exited=true。 | PASS |
| hold/ignore-termination 第 3 轮 | READY；child PID 12356；graceful 后 force；max sequence=7；child_gone=true、STOPPED=true、daemon_exited=true。 | PASS |
| CF-01 双进程 oracle | owner 15016/child 14824 READY；competitor 16800 退出且仅 `WRITER_GUARD_HELD`、无副作用；owner/child 最终消失并 STOPPED。 | PASS |

停止预算说明：产品脚本在发 shutdown 后用 15 秒等待 STOPPED，并等待 daemon exit；三轮 hold 外层使用 45 秒硬预算，包含 15 秒 hold、8 秒 graceful 窗和进程退出余量。每轮均在预算内自然返回，未由评审强杀有效样本。所有有效样本都同时断言 STOPPING、STOPPED、child disappearance 与 daemon exit；最大 sequence 为 7 或 12，没有 R2 所见的队列/sequence 风暴。

## 8. 新发现

本轮没有新增 F10。Node 的 DEP0190 是现有工具以 Windows `shell: true` 传参产生的弃用/安全提示，未改变测试退出码；真实产品参数不来自不受信任输入。本轮将它记为维护提示而非 M2 验收发现。

## 9. 无问题确认清单

- PASS：PROMPT.md 保持未跟踪；冻结 six-elements/overall-plan/detailed-plan、契约、实现、工具和 `dsh/` 均未被本评审修改。
- PASS：F01 干净检出可重复构建，两轮 bin.js digest 相同，未使用历史产物冒充。
- PASS：F02 原子替换、F03 LockFileEx/flock、F04 BLOCKED-EXTERNAL 口径、F06 reducer/snapshot 均未回退。
- PASS：F05/F09 的 typed shutdown、hold deadline、ignore-termination、child-gone 先、stop 先、重复 shutdown 均有本轮证据。
- PASS：F07 环境归因已更正；F08 的 174 个本地链接与契约 10 paths/42 schemas/66 declared 全绿。
- PASS：真实 probe=HTTP_200 发生在两代 Harness，不是 fake 的 `probe=HTTP_OK`。
- PASS：token/cookie 日志为 REDACTED；隔离 HOME、USERPROFILE、XDG_STATE_HOME、DSH_HOME/状态每轮重新创建。
- PASS：Windows 树所有权按 `CREATE_NEW_PROCESS_GROUP`+taskkill tree+Child handle 表述，未虚构 job object；Unix 对应 process group/flock。
- PASS：runner 的 executed=4 是真实已执行子集，没有把 declared=66 写成 66 行为全通过。
- PASS：中央注册/lease、M3 管理 API、M4/M5 HTTP/WS 透明代理、M6 中央裁决和跨 task single-attach 仍明确在 M2 范围外。

## 10. 下一步建议

1. 解除 GitHub Actions 账户计费/runner 外阻后，在本验收 commit 对应的同一代码状态取得一次 build/lint/typecheck/unit/contract/real-harness/runner/secret 全绿 run 与 artifact，将 AC-01、VM-01 从 BLOCKED-EXTERNAL 更新为 PASS。
2. 后续维护可把 Windows job object 作为更强的 descendant containment 方案，并将 DEP0190 对应的 shell 参数调用改为无 shell 的安全 argv；二者均不得改变当前已验证契约。
3. 进入 M3 时复用 M2 的 typed lifecycle port、immutable snapshot 和 connection context，不得绕过 coordinator 直接修改 observed state，也不得把 M2 的四个 executed 场景扩写为 66 个行为已通过。
4. 保留本轮两轮产品链、三轮停止循环、CF-01 与 validator 的摘要作为 R3 证据索引；不得用后续单次成功 transcript 覆盖本轮的独立多轮结论。
