# M2「进程与认证」第二轮独立验收报告（R2）

## 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| R2 | 2026-08-30 | Remote Agent | 独立复核迭代 4 对 R1 F01～F07 的修复，执行干净检出真实产品链、CF-01、Rust/工具门禁和原生 Windows venv 契约验证。 | `PROMPT.md`、M2 冻结六要素与计划、中央一致性契约、独立实测输出 |

## 1. 总体结论

总体结论：未通过独立验收

迭代 4 已真实修复 R1 最关键的 F01：本轮在全新 detached worktree、全新 HOME/USERPROFILE/XDG/DSH 状态目录中，从 frozen lock 安装和 CLI 构建开始运行产品链，成功生成并校验 `dsh/apps/cli/lib/bin.js`，随后由 dshd 装配路径完成两代真实 Harness 的认证、probe、crash recovery 与停止。F02、F03、F04、F06 也有充分代码和运行证据。可是独立复跑同时发现两个不能忽略的新事实：原生 Python 3.12 venv 可用，`validate_contracts.py` 并非环境阻断而是因 M2 两份计划文档的 13 个本地链接断裂真实 exit=1；另一次 CF-01 owner 自动 shutdown 在子进程已消失后仍停留 STOPPING，dshd 超过观察窗未退出。后者使 F05 只能 PARTIAL，前者使契约门禁失败并推翻 F07 的环境归因。

四个维度结论为：阶段目标达成 **FAIL**；交付物与计划符合度 **CONCERNS**；代码评审 **CONCERNS**；真实测试复跑 **FAIL**。远程 GitHub Actions 的计费/runner 外阻仍未解除，因此 AC-01、VM-01 继续诚实记为 `BLOCKED-EXTERNAL`，本地成功不得冒充远程单次全绿。

## 2. 维度一：阶段目标达成（FAIL）

### 2.1 AC/VM 重估表

| 项目 | R2 独立证据 | 结论 |
| --- | --- | --- |
| AC-01 | GitHub Actions 计费/runner 外阻未解除；本轮本地 Rust、drift、自检不能代替同一 commit 的远程 run/artifact。 | BLOCKED-EXTERNAL |
| AC-02 | CF-01 有效复跑：owner PID 15856 持 OS 锁，spawn child PID 19164 并进入 READY/generation 1；competitor PID 10872 exit=1，仅 stderr `WRITER_GUARD_HELD`，stdout 无 guard、child、local 或 READY；另一路 owner 被强制结束后 successor PID 3116 取得 `guard=HELD`。 | PASS |
| AC-03 | 干净检出产品链 exit=0：dshd PID 12896；Harness PID 17336→13240；generation 1→2；两代 `exchange=303`、`probe=HTTP_200`；crash→1000ms backoff→N+1；最终 graceful→timeout→force→STOPPED。 | PASS |
| AC-04 | reducer 优先级、late fence、desired durable、snapshot subscription 单测通过；决定性干净产品链最终 STOPPED 且 desired 保留。但额外 CF owner 自动 shutdown 卡在 STOPPING，关闭收敛并非所有入口稳定。 | CONCERNS |
| AC-05 | exact authority 单测通过；真实两代仅使用 `127.0.0.1:<dynamic>`，probe 后才 READY；token/cookie 输出均 REDACTED。 | PASS |
| AC-06 | config/identity 单测与 main 装配顺序证明非法输入在 guard/supervisor 之前 fail-closed；本轮 workspace test 全绿。 | PASS |
| AC-07 | conformance-runner 自检实际输出 `declared=66 executed=4 passed=4 failed=0 driver=m2-local`；未把 62 个未执行向量写成通过。 | PASS |
| VM-01 | 无远程同 commit、单次全绿 CI 证据。 | BLOCKED-EXTERNAL |
| VM-02 | 完整双 OS 进程竞争、owner 实际 child/READY、competitor 无副作用以及 crash-owner 后 successor 重取均已独立观察。 | PASS |
| VM-03 | 新 worktree 从安装/构建开始完成真实两代产品时间线，非历史 transcript。 | PASS |
| VM-04 | runner 自检与 R4 selftests-real 均通过，动态计数为 executed=4。 | PASS |
| VM-05 | 原子 desired、OS 锁、late/duplicate/out-of-order、snapshot 订阅等 unit 通过；但 validator 发现冻结计划链接真实错误，且停止竞态出现卡住。 | FAIL |
| VM-06 | 因契约验证器 exit=1、关闭收敛不稳定、AC-01/VM-01 外阻，不能签署全部出口门禁 PASS。 | FAIL |

阶段出口原文要求“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”。“连接真实 Harness”与 runner 诚实计数本轮已重现，但“可靠管理”要求停止路径稳定有界；同时干净契约验证不能失败。因此阶段目标仍不能签署通过。

## 3. 维度二：交付物与计划符合度（CONCERNS）

### 3.1 T01～T18 复核

| 任务 | R2 结论与证据 |
| --- | --- |
| T01 | PASS：冻结 Harness lock SHA-256 与基线一致；真实脚本打印 frozen-lock 安装，CLI digest 可复现。 |
| T02 | PASS：config、identity、exact authority 与 secret redaction 测试通过。 |
| T03 | PASS：`AtomicFile` 同目录 replace、数据 sync 和 Unix parent sync 落地；desired old-or-new 完整值测试通过。 |
| T04 | PASS：WriterGuard 使用 fs4 的 owner-bound 内核锁；Windows 对应 `LockFileEx`、Unix 对应 `flock`；完整 CF-01 oracle 与 successor 重取已复跑。 |
| T05 | PASS：单 reducer 的 generation、late completion、shutdown、priority、乱序/重复测试均执行。 |
| T06 | PASS：coordinator 提供不可变 snapshot 订阅；关闭 watcher 不阻塞 reducer 的测试通过。 |
| T07 | CONCERNS：8 秒 stop timeout、graceful/force 阶段和进程组代码存在；决定性产品链成功，但另一真实 owner 在 child gone 后未发布 Stopped。 |
| T08 | CONCERNS：干净链的 crash→backoff→N+1 和 typed shutdown 成功；额外 hold deadline shutdown 未稳定收敛。 |
| T09 | PASS：只接受 exact `127.0.0.1` authority，localhost 负例由 core 测试拒绝。 |
| T10 | PASS：两代真实 exchange=303、probe=HTTP_200 后才发布 ConnectionContext/READY，cookie 脱敏。 |
| T11 | PASS：fake-harness 连续两次 self-test 全绿，覆盖 fragmented/delayed/malformed/token/probe/crash/hang。 |
| T12 | PASS：reference-stub 连续两次 PASS，仍声明 behavior=NOT_IMPLEMENTED，STALE_INSTANCE/FENCED 仅作本地输入。 |
| T13 | PASS：main 顺序为 config→identity→desired→guard→coordinator→supervisor；CF competitor 在 guard 门失败，无 spawn 副作用。 |
| T14 | PASS：独立新检出从 frozen install、CLI build、bin.js digest 到两代真实 Harness 全链 exit=0。 |
| T15 | PASS：manifest 保持 declared=66，实际 executed=4/passed=4/failed=0。 |
| T16 | FAIL：本地 Rust/工具门禁通过，但原生 venv `validate_contracts.py` 因断链 exit=1；远程 CI 又是 BLOCKED-EXTERNAL。 |
| T17 | CONCERNS：原子、锁、竞态、secret 主项有证据；停止强化未覆盖并消除本轮卡住情形。 |
| T18 | FAIL：不存在“干净运行全部门禁全绿”；契约 validator 失败且 AC-01/VM-01 仍外阻。 |

### 3.2 D1～D9 重估

| 交付物 | 状态 | 说明 |
| --- | --- | --- |
| D1 | PASS | 配置/身份规则、create-if-absent、fail-closed 测试成立。 |
| D2 | PASS | 原子 replace 与真实 OS writer guard 均落地；CF-01 完整竞争和 successor 实测成立。 |
| D3 | PASS | 单 reducer、typed effect、优先级/late fence 与 snapshot subscription 已实现并测试。 |
| D4 | CONCERNS | 主产品链 recovery/stop 成功，但额外 shutdown 卡在 STOPPING，稳定性不足。 |
| D5 | PASS | 真实 exact authority exchange/probe 与 generation context 已重现。 |
| D6 | PASS | 新检出可重复构建并连接固定真实 Harness，两代 PID 与 digest 齐全。 |
| D7 | PASS | fake/stub 各连续两次稳定，且没有冒充产品行为。 |
| D8 | PASS | runner 的 66 declared 与 4 executed 口径一致。 |
| D9 | FAIL | 契约 validator exit=1；远程 CI 无 artifact；exit-record 的 F07 环境归因与实际原生 Python 可用事实不符。 |

## 4. 维度三：代码评审（CONCERNS）

### 4.1 文件持久化与 writer guard

`files.rs` 已移除 R1 的 delete-then-rename：identity 使用 `DisallowOverwrite`，desired 使用 `AllowOverwrite`，临时文件由 atomicwrites 在同目录提交，写入前 `sync_all`，Unix 还同步 parent directory。该结构满足平台原子 replace 的核心语义。测试证明重读只得到完整 RUNNING 或 STOPPED；虽然故障点粒度仍可继续加强，但 R1 指出的删除窗口已不存在。

WriterGuard 持有 `File` RAII handle，并调用 fs4 `try_lock_exclusive`。源码注释和依赖映射明确 Windows `LockFileEx` / Unix `flock`；`writer.lock` 的存在不代表占用。unit 证明同进程竞争失败、drop 后 successor 成功、stale lock path 不阻塞；本轮真实双进程又证明 competitor 无 child/READY。F03 的根因已消除。

### 4.2 reducer 与 snapshot

`dshd-core` 测试从 R1 的少数主例扩展到优先级、late、duplicate、out-of-order 与 terminal-state 不复活；本轮 `cargo test` 显示 core 9 tests 全绿。coordinator subscription 发布克隆的不可变 Snapshot，closed/slow watcher 不阻塞 reducer，符合后续健康/管理消费边界。F06 可判 FIXED。

### 4.3 supervisor

supervisor 设置默认 `stop_timeout=8s` 且可测试注入。Unix spawn 使用独立 process group，停止先对组发 TERM、超时发 KILL；Windows 使用 `CREATE_NEW_PROCESS_GROUP`，先 `taskkill /T`、超时后 `taskkill /T /F` 并对精确 child handle kill/wait。干净产品链确实输出 graceful、8000ms、timeout-force-kill、Stopped，说明主路径有效。

但实现方修复表称 Windows 使用 job object，源码并无 job object；而本轮第二次真实 owner 自动 shutdown 中，child PID 19164 已消失，dshd PID 15856 仍在 85 秒后存活，日志终止于 `child-exited`，没有 Event::Stopped/observed Stopped。评审随后强制结束残留 dshd。该事实不是孤儿 child（child 已 gone），却违反“有界收敛 STOPPED”。因此 F05 不能判完全修复。

### 4.4 构建脚本与证据诚实性

`run-m2-real-harness.mjs` 的前置链实际执行 corepack pnpm frozen-lock install、pnpm build、bin.js existence check 与 SHA-256；任何步骤失败均包装为 PRECONDITION_FAILED。它还重新 `cargo build --locked -p dshd`，使用临时运行根并断言两代 PID/generation/probe/最终停止。本轮新 worktree 没有任何历史 `lib/` 产物，故 F01 的修复是真实而非关键词门禁。

## 5. 维度四：真实测试复跑（FAIL）

以下均为本评审于 2026-08-30 的真实输出摘要。当前 shell 最初未解析 git/cargo；定位现有绝对路径并补入进程 PATH 后执行有效门禁，未把工具启动失败记作产品失败或通过。

| 命令/场景 | 真实输出摘要 | 判定 |
| --- | --- | --- |
| `cargo check --workspace --all-targets --locked` | Rust 1.89 workspace 完成，Finished dev profile。 | exit=0 PASS |
| `cargo test --workspace --locked` | adapters 9、core 9、contract/tools 与 doc tests 全绿；drift gate `RESULT=PASS ZERO_DRIFT files=4`。 | exit=0 PASS |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | 无 warning。 | exit=0 PASS |
| `cargo fmt --all -- --check` | 无格式差异。cargo fmt 本身无 `--locked` 参数，故按标准形式执行。 | exit=0 PASS |
| `node tools/check-m2-impl-r4.mjs --mode drift-real` | `RESULT=PASS MODE=drift-real`。 | exit=0 PASS |
| `node tools/check-m2-impl-r4.mjs --mode selftests-real` | `RESULT=PASS MODE=selftests-real`；仅有 Node DEP0190 warning。 | exit=0 PASS |
| fake-harness `--self-test` ×2 | 两次 `SELF_TEST=PASS`，8 类 fixture，`vectors_executed=0`。 | 两次 PASS |
| reference-stub `--self-test` ×2 | 两次 PASS，route_probe=13/13，behavior=NOT_IMPLEMENTED。 | 两次 PASS |
| conformance-runner `--self-test` | `declared=66 executed=4 passed=4 failed=0 driver=m2-local`。 | PASS |
| 干净检出准备链 | 新 detached worktree 9bac5ae；全新 HOME/USERPROFILE/XDG/DSH；frozen install 后 pnpm build；`bin.js` SHA-256 `dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166`。 | PASS |
| 干净检出真实产品链 | dshd 12896；PID 17336→13240；generation 1→2；两代 exchange=303/probe=HTTP_200；1000ms backoff；graceful→8s timeout→force→STOPPED；`RESULT=PASS`。 | PASS |
| CF-01 完整竞争 | owner 15856、child 19164、READY generation 1；competitor 10872 exit=1、`WRITER_GUARD_HELD`、stdout 空；无 child/local/ready。 | PASS |
| owner crash→successor | 无 Harness 的 guard owner PID 18736 被强制结束；同 state successor PID 3116 exit=0、`guard=HELD`。 | PASS |
| CF owner 自动 shutdown | child 19164 在 force 阶段消失，但 owner 15856 超过 85 秒仍存活，最后状态 Stopping；评审强制清理 owner。 | FAIL |
| 原生 venv 安装 | `C:\Program Files\Python312\python.exe -m venv` 成功；锁定 openapi-spec-validator 0.7.1、PyYAML 6.0.2、jsonschema 4.26.0 安装成功。 | PASS |
| venv `validate_contracts.py` | exit=1；13 个 broken local Markdown links，涉及 M2 overall/detailed plan 指向 `docs/...` 的错误相对路径；未得到预期 10 paths/42 schemas/66 declared PASS。 | FAIL |

第一次 CF 编排使用带空格 Node 路径时，PowerShell 参数拆分导致 owner 未 spawn，并在 competitor 启动前退出；competitor 因而合法取得 guard。该无效尝试未计入上表产品判定，随后用 Windows 短路径完成有效 CF-01。

## 6. F01～F07 处置对质

| 发现 | R2 状态 | 独立证据 |
| --- | --- | --- |
| F01 | FIXED | 新 worktree 中无历史 bin.js；脚本真实执行 frozen-lock install/build，产出 digest 后才启动；两代真实产品链完整 PASS。 |
| F02 | FIXED | atomicwrites AllowOverwrite/DisallowOverwrite 替代 remove+rename；数据/Unix parent sync；old-or-new 测试 PASS。 |
| F03 | FIXED | fs4 OS 内核锁绑定 RAII handle，Windows LockFileEx/Unix flock；真实 owner/competitor 与 crash-owner/successor 均通过。 |
| F04 | FIXED | exit-record 已将 AC-01/VM-01 如实改为 BLOCKED-EXTERNAL，没有把本地结果冒充远程 CI。 |
| F05 | PARTIAL | 主产品链 graceful→8s→force→STOPPED 成功，child 无孤儿；但额外真实 shutdown 卡在 STOPPING，且 Windows 源码没有自报的 job object。 |
| F06 | FIXED | priority、late/duplicate/out-of-order fence、terminal no-revive 和 immutable snapshot subscription 测试均落地并通过。 |
| F07 | NOT-FIXED | Cygwin Python 确会有 wheel 问题，但本机原生 Python 3.12 可用；venv 安装成功后 validator 真实 FAIL。环境阻断说明遗漏可用解释器并掩盖了契约断链。 |

## 7. 新发现

### F08：M2 冻结计划包含断裂的本地 Markdown 链接

- 维度：交付物与计划符合度 / 真实测试复跑
- 严重度：BLOCKER
- 位置：`docs/milestones/m2/overall-plan.md`、`docs/milestones/m2/detailed-plan.md`
- 证据：原生 Windows Python 3.12 临时 venv 中锁定依赖安装成功，`validate_contracts.py` exit=1，列出 13 个 broken links。两文档使用从自身目录出发无效的 `docs/...` 相对链接。
- 影响：T16/T18、D9、VM-05/VM-06 不成立；CI 外阻解除后 contracts job 也会失败。
- 建议：按冻结变更流程修正链接，不得通过放宽 validator 规避；在原生 venv 与 CI 重新取得 `Contract validation: PASS`、10 paths、42 schemas、66 declared。

### F09：一种真实 shutdown 编排未有界发布 STOPPED

- 维度：代码评审 / 真实测试复跑
- 严重度：MAJOR
- 位置：`crates/dshd-adapters/src/supervisor.rs` stop/child monitor 与 `crates/dshd/src/main.rs` hold deadline 路径
- 证据：owner PID 15856 从 READY generation 1 进入 graceful→timeout-force-kill，child PID 19164 已消失且输出 child-exited，但 85 秒后 dshd 仍存活，snapshot 最后为 Stopping；评审强制清理。
- 影响：F05 仅 PARTIAL；ST-14/AC-04 的“任意关闭入口有界 STOPPED”不能仅凭另一条成功 transcript 推定。
- 建议：增加重复执行的 ignore-termination/hold-deadline 产品测试，检查 child wait 与 monitor 竞争，明确 Windows job object 或等价树所有权，并断言 dshd 自身在 8 秒预算后退出。

## 8. 无问题确认清单

- PROMPT.md 保持未跟踪；没有修改 `dsh/`、契约、M1/M2 冻结文件或实现代码。
- F01 干净链不是历史 transcript，bin.js digest 与本轮构建关联。
- 两代 PID 不同，generation 1 与 generation 2 均真实 READY，probe=HTTP_200。
- secret、launch token、cookie 在输出中均为 REDACTED；未发现持久化明文证据。
- writer guard 为 OS owner lock，不再以 stale sentinel 文件代表所有权。
- runner 仍诚实报告 declared=66、executed=4，不宣称 66 个行为已执行。
- 中央注册/租约、管理 API、HTTP/WS proxy 与跨节点 single-attach 仍明确属于后续里程碑或部署层。

## 9. 下一步建议

1. 按冻结文档变更流程修复 F08 的 13 个链接，并用原生 Python 3.12 venv 重跑到 validator 10/42/66 PASS。
2. 定位 F09 的 child monitor/Stop 竞态，补至少多轮 ignore-termination 与 hold deadline 黑盒测试，要求每轮子进程及 dshd 均在预算内消失并发布 STOPPED。
3. 重新执行本报告全部 Rust、R4 checker、fake/stub/runner、CF-01 与干净真实 Harness 链；不得只重跑失败项后拼接结论。
4. GitHub Actions 计费/runner 外阻解除后，在同一修复 commit 取得单次全部 job 全绿及 artifact，再把 AC-01、VM-01、VM-06 从 BLOCKED-EXTERNAL 重估。

