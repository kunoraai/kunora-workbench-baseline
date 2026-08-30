# M2「进程与认证」独立验收报告（R1）

## 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| R1 | 2026-08-30 | Remote Agent | 独立阅读冻结输入、实现和既有报告，执行本机复跑并重估 M2。 | `PROMPT.md`、M2 冻结计划、中央一致性契约 |

## 1. 总体结论

总体结论：未通过独立验收；真实 Harness 的 dshd 产品路径在本次独立复跑中因冻结入口产物缺失而无法进入 READY/generation 1，AC-03/VM-03 的关键出口事实未重现，且 CI、CF-01 完整 oracle 与临时 venv 契约验证仍有证据缺口。

本报告以独立复跑而非实现方自报为准。四个评审维度结论为：阶段目标达成 **FAIL**；交付物与计划符合度 **CONCERNS**；代码评审 **CONCERNS**；真实测试复跑 **FAIL**。本地 Rust 门禁、两类 fixture 自检、runner 诚实计数均通过，但不能替代冻结真实 Harness 的启动→认证→probe→READY→crash→backoff→READY N+1→停止链。GitHub Actions 计费/runner 外阻尚未解除，故 AC-01/VM-01 只能记 `BLOCKED-EXTERNAL`，不能用本地全绿冒充远端 CI。

## 2. 维度一：阶段目标达成（FAIL）

### 2.1 AC/VM 重估表

| 项目 | 独立判据 | 独立证据与差异 | 结论 |
| --- | --- | --- | --- |
| AC-01 | 干净检出后同一 GitHub Actions run 的 build/lint/typecheck/unit/contract 全绿 | 本地 cargo/checker 多项通过；题设明确远端 Actions 仍受计费/runner 阻断，未取得远端 run ID 和单次 CI artifact。`exit-record.md` 的 PASS 不能替代 CI。 | BLOCKED-EXTERNAL |
| AC-02 | 同卷双 dshd：owner 持 guard 并 spawn，competitor 输出 `WRITER_GUARD_HELD`、无 child、不可 local/ready | 独立双 OS 进程得到 owner PID 12592、competitor PID 15064/exit=1/规定错误；但 CIM child 枚举 Access denied，且此入口未给 owner 配置 Harness，未证明“owner spawn、competitor 无 child/local/ready”的完整 oracle。 | CONCERNS |
| AC-03 | 冻结真实 Harness 经 dshd 装配完成两代真实认证/probe，crash 后 N+1 | 先 build dshd 后运行 `node scripts/run-m2-real-harness.mjs`：真实子进程 PID 2920、14792、11576、9124、9112、17656、17456、17800 均因 `dsh/apps/cli/lib/bin.js` 不存在退出；退避 1/2/4/8/16/30 秒；generation 始终 0，约 95 秒 `generation 1 READY timeout`，exit=1。未重现自报 PID 18956→17444、generation 1→2、两代 HTTP_200。 | FAIL |
| AC-04 | desired/observed 正交；STOPPED 重启不 spawn；shutdown 有界收敛并保留 desired | reducer 和 desired store 单测通过，shutdown 晚到认证 fence 通过；但本轮真实链未到 READY，无法独立完成 READY→SIGTERM→STOPPED 的产品级验证。 | CONCERNS |
| AC-05 | exact authority；probe 后才 READY；token/cookie 仅内存且不泄漏 | `ReadyUrl` 拒绝 localhost，Bootstrap 使用同 authority Host，Secret Debug 脱敏；单测通过。真实 exchange/probe 本轮未发生，故真实环境门禁未闭环。 | CONCERNS |
| AC-06 | 非法 endpoint/node_id 在 listener/spawn 前 fail-closed 且不覆盖 identity | config/identity 单元测试和 main 装配顺序支持该结论；本轮 cargo test 通过。测试矩阵较冻结计划要求更窄，未见完整端口监听/PID/hash 黑盒矩阵。 | CONCERNS |
| AC-07 | runner 保持 66 declared，仅实际 driver 动态计 executed | 独立运行输出 `declared=66 executed=4 passed=4 failed=0`，条目为 ID-01、ID-02、CF-01、ST-06；其余仍 declared，未把 self-test 当向量执行。 | PASS |
| VM-01 | 干净环境完整远端 CI 单次全绿 | 本地复跑不是 GitHub Actions；无远端 run/artifact。 | BLOCKED-EXTERNAL |
| VM-02 | 双进程单写完整实测 | 锁竞争和规定错误重现；owner spawn、competitor child/local/ready 的完整观测未重现。 | CONCERNS |
| VM-03 | 真实 Harness 产品路径完整时间线 | dshd 装配确被启动，但入口模块缺失导致所有 attempt 在认证前退出；无 READY、真实 probe、generation 或 N+1。 | FAIL |
| VM-04 | runner declared/executed 与报告一致 | `declared=66 executed=4 passed=4 failed=0`，通过。 | PASS |
| VM-05 | 非法输入、损坏文件、并发写和晚到事件 | 相关 unit 覆盖部分成立；没有独立复现全部 I/O 故障点、并发 create-if-absent 和黑盒副作用证明。 | CONCERNS |
| VM-06 | 对照路线图原文签核 | 因 AC-03/VM-03 FAIL，不能签署“可靠管理并连接真实 Harness”；未实施中央/管理/代理范围的声明诚实。 | FAIL |

阶段目标的决定性失败不是“fake 不稳定”，而是本次指定产品入口真实运行未生成任何成功 connection context。实现方历史报告可作为既有证据，但冻结验收要求评审员亲自复跑，且明确规定结果不一致时以独立复跑为准。

## 3. 维度二：交付物与计划符合度（CONCERNS）

### 3.1 T01～T18 逐任务核验

| 任务 | 完成判据摘要 | 核验证据 | 结论 |
| --- | --- | --- | --- |
| T01 | 冻结版本、摘要、范围与 M1 扩展点审计 | `t01-audit.md` 记录 Rust 1.89.0、66 分组、Harness commit/tree/lock；本轮实际阅读冻结输入、M1 文档与代码。 | PASS |
| T02 | config/identity 纯规则正反例 | core 无 OS 调用；UUID、URL、端口、Secret redaction 单测通过，但 URL/端口/副作用矩阵不完整。 | CONCERNS |
| T03 | identity/desired 原子文件、create-if-absent、故障注入 | durable desired 单测通过；实现采用先 `remove_file` 后 `rename`，替换窗口并非冻结计划所述原子替换；并发 identity 初始化也缺完整恢复策略。 | CONCERNS |
| T04 | CF-01 双进程完整 oracle | 真实竞争复现 `WRITER_GUARD_HELD`；但锁是 `create_new` 哨兵文件而非 OS owner lock，且本轮无法证明 owner spawn/competitor 无 child。 | CONCERNS |
| T05 | 状态迁移、优先级表穷举 | 单 reducer、typed Event/Effect、late fence 存在；仅 3 个 reducer 测试，远少于 ST-01/03/04/05/06/07/08/10/11/12/13/14 穷举。 | CONCERNS |
| T06 | coordinator effect loop、immutable snapshot 订阅、取消 | 有界 sync channel 串行 reducer，effect completion 回送；snapshot 是 `RwLock` 轮询读取，不是计划描述的 watch/broadcast 订阅，也未覆盖队列满/consumer 消失安全态。 | CONCERNS |
| T07 | supervisor spawn/exit/timeout/process group/退避 | 真实 spawn/exit 与 1/2/4/8/16/30 秒上限退避在失败链重现；未见通用 ready timeout、Unix process group 和 8 秒 TERM→KILL 升级实现。 | CONCERNS |
| T08 | crash/stop/shutdown/fence 恢复收敛 | reducer unit 证明 late auth 不复活；真实入口失败只证明反复退避，未证明 READY crash 后 generation N+1 和 SIGTERM 收敛。 | FAIL |
| T09 | exact authority parser 完整负例 | `127.0.0.1` 接受、localhost 拒绝；parser 亦拒绝换行/@/#/额外 token 分隔。fuzz/歧义输入覆盖未达到计划全部要求。 | PASS |
| T10 | cookie exchange、probe、context 与 secret | 代码中 cookie 为 Secret，probe 成功后才发 `BootstrapSucceeded`；本轮无真实 exchange/probe，且 HTTP read 只有 read timeout、无响应大小上限。 | CONCERNS |
| T11 | fake Harness 八类确定 fixture | 连续两次 self-test PASS：ready-fragmented、ready-delayed、malformed-url、token-rejected、probe-failed、crash-immediate、crash-delayed、hang。 | PASS |
| T12 | stub 仅注入中央事件 | 连续两次 self-test PASS，明确 `behavior=NOT_IMPLEMENTED`，支持 unreachable/STALE_INSTANCE/FENCED，不冒充 M6。 | PASS |
| T13 | main 顺序装配且 fail-closed | 代码顺序为 config→identity→desired→guard→coordinator→supervisor，产品脚本确启动该路径；没有生产 listener/health 实现，local/ready 观测只表现为日志 snapshot。 | CONCERNS |
| T14 | 固定真实 Harness 启动、认证、probe、READY、crash、N+1、停止 | 历史报告声称成功，但本轮脚本因冻结入口构建产物缺失 FAIL，generation 0；完成判据不成立。 | FAIL |
| T15 | runner driver、66 声明和诚实计数 | runner self-test 输出动态 `executed=4`，计数一致；但 CF-01 driver 的完整产品 oracle 仍弱。 | CONCERNS |
| T16 | capability evidence 与 M2 CI | 本地 drift/check/test/clippy 等通过；远端 CI 外阻，无单次全绿 artifact。 | BLOCKED-EXTERNAL |
| T17 | 并发/故障/secret 强化 | Secret Debug 脱敏和有限竞态测试成立；`t17-hardening.md` 自身写明真实 Harness N+1 曾 BLOCKED，而 exit-record 后续虽更新却未消除本轮失败。 | CONCERNS |
| T18 | 干净运行、AC/VM artifact、出口签核 | exit-record 有 AC/VM 索引和未实施项，但将 AC-01/VM-01 写 PASS 与指定环境口径冲突；本轮 AC-03/VM-03 也失败。 | FAIL |

### 3.2 D1～D9 状态

| 交付物 | 状态 | 核验说明 |
| --- | --- | --- |
| D1 配置与身份真实化 | CONCERNS | 纯规则、持久读取和 mismatch 存在；原子/并发/权限故障完成定义未全部证明。 |
| D2 原子状态与单写基础 | CONCERNS | desired 可持久；CF-01 竞争错误重现，但 OS 锁所有权、owner spawn 与无 child oracle 不完整。 |
| D3 state coordinator | CONCERNS | 单 reducer、typed effect、late fence 与 snapshot 存在；优先级穷举和真正订阅接口不足。 |
| D4 supervisor/reconcile | FAIL | 失败退避可见，但真实 READY crash→backoff→N+1→SIGTERM 产品链未重现。 |
| D5 认证引导 | CONCERNS | exact authority、内存 cookie、probe 前置在代码中成立；真实路径未到认证。 |
| D6 冻结真实 Harness | FAIL | 指定脚本 exit=1，冻结入口 `lib/bin.js` 缺失；两代 PID/generation/真实 probe 证据未产生。 |
| D7 fake/stub 增量 | PASS | fixture 与注入工具连续自检稳定，且明确 vectors_executed=0。 |
| D8 runner | CONCERNS | `declared=66` 与 `executed=4` 诚实；所提升 CF-01 的完整 e2e oracle 有缺口。 |
| D9 evidence/CI/exit | FAIL | artifact 索引存在，但 exit-record 的 AC-01/VM-01 口径不实，且关键真实复跑不可重现。 |

## 4. 维度三：代码评审（CONCERNS）

### 4.1 `dshd-core`

core 只使用标准纯类型和 reducer，没有文件、进程或网络副作用；config、identity、state 责任基本清楚。`Secret` 没有 Display 实现，Debug 固定输出 `Secret([REDACTED])`。`ConnectionContext` 含 authority/origin/cookie/generation，generation 仅在 `BootstrapSucceeded` 且 attempt/current/desired/shutdown/fence 条件满足时递增，晚到结果被 current-attempt fence 丢弃。这些符合主要边界。

不足在于冻结计划要求的状态表穷举没有兑现：reducer 测试只有 generation、late completion、shutdown 三个主例。`Fence` 将 observed 先设为 Fenced，Stop 完成后又变为 Stopped；这可解释为进程收敛，但没有测试验证 ST-04/ST-13 的 registration=FENCED 与 observed=STOPPED 组合。错误原因仍是自由字符串，未形成完整 typed error 后果映射。

### 4.2 `dshd-adapters`

OS/文件/进程/网络确实集中在 adapters。coordinator 使用容量 64 的 channel 串行归约，supervisor 执行 Spawn/Bootstrap/ScheduleBackoff/Stop，认证请求保持 exact Host，cookie 不落入持久模型。子进程环境会移除名称含 KEY/SECRET/TOKEN/PASSWORD 的变量，并设置 telemetry 禁用变量；日志对 ready token/cookie 直接 REDACTED，stderr 经过 redaction。

主要问题有三项。其一，`atomic()` 在目标存在时先删除目标再 rename，存在目标暂时不存在的窗口，不符合“旧或新完整文件始终存在”的原子替换定义。其二，WriterGuard 是 `create_new(writer.lock)` 并在 Drop 删除，不是由内核绑定 owner 生命周期的 flock/文件锁；异常退出会遗留 stale lock，后继进程永久得到 `WRITER_GUARD_HELD`。其三，supervisor 的 Stop 在 Windows 直接 taskkill/kill，没有冻结方案所述可配置 8 秒 graceful timeout 后升级；Unix 也未设置独立 process group。ready 读取虽有 100000 字符保留上限，但没有独立 ready deadline；HTTP response 使用 `read_to_string`，仅有 5 秒 read timeout、无字节上限。

### 4.3 `dshd` main

main 的装配顺序符合 config→identity→desired→guard→coordinator→supervisor，非法 config/identity/desired/guard 在 supervisor 之前失败；没有第二套 reducer、DTO、错误码或 vector manifest。main 通过 stdin typed command 注入 shutdown/fence，适合作为 M2 内部测试入口，但没有实际 listener/health server，因此计划中 local/ready 健康观测并未完整落地。进程环境先从 parent 收集非敏感项再由 spawn 再次移除敏感名称，防护方向正确。

### 4.4 工具、工作流与生成物

fake/stub/runner/capability-report 保持原工具边界；runner 明确 66 declared 与 4 executed。`cargo test` 内 drift gate 输出 `ZERO_DRIFT files=4`，未发现手改生成物。`.github/workflows/m1.yml`/M2 相关检查提供本地结构门禁，但远端运行证据不可用。没有发现新增第二套 contract DTO 或 manifest。

## 5. 维度四：真实测试复跑（FAIL）

| 命令 | 真实输出摘要 | 退出/判定 |
| --- | --- | --- |
| `cargo check --workspace --all-targets --locked` | workspace crates 全部检查完成，`Finished dev profile`。 | exit=0 PASS |
| `cargo test --workspace --locked` | core 7、adapters 5、contract 及工具测试全部通过；drift test：`RESULT=PASS ZERO_DRIFT files=4`。 | exit=0 PASS |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | 全 workspace 检查完成，无 warning。 | exit=0 PASS |
| `cargo fmt --all -- --check` | 无输出、无格式差异。 | exit=0 PASS |
| `node tools/check-m2-impl-r3.mjs --mode drift-real` | 首次因 PATH 中无 git：`spawnSync git ENOENT`；补入现有 Git/Cargo 路径后 `RESULT=PASS MODE=drift-real`。 | 有效复跑 exit=0 PASS |
| `node tools/check-m2-impl-r3.mjs --mode selftests-real` | `RESULT=PASS MODE=selftests-real`；伴随 Node DEP0190 警告。 | exit=0 PASS |
| `cargo run --locked -p fake-harness -- --self-test` ×2 | 两次均 `SELF_TEST=PASS`；8 类 fixtures 齐全；`vectors_executed=0`。 | 两次 exit=0 PASS |
| `cargo run --locked -p reference-stub -- --self-test` ×2 | 两次均 PASS；route_probe=13/13；`behavior=NOT_IMPLEMENTED`；三类本地注入齐全。 | 两次 exit=0 PASS |
| `cargo run --locked -p conformance-runner -- --self-test` | `SELF_TEST=PASS ... declared=66 executed=4 passed=4 failed=0 driver=m2-local`。 | exit=0 PASS |
| `cargo build --locked -p dshd` | 生成脚本所需 `target/debug/dshd.exe`。 | exit=0 PASS |
| `node scripts/run-m2-real-harness.mjs` | 未 build dshd 时首次为 dshd.exe ENOENT；build 后有效复跑：dshd PID 17120，8 个 child attempt 均 `MODULE_NOT_FOUND dsh/apps/cli/lib/bin.js`；退避有界；generation=0；`generation 1 READY timeout`。 | exit=1 FAIL |
| CF-01 双进程 PowerShell oracle | owner PID 12592 输出 `guard=HELD`；competitor PID 15064 exit=1、stderr `WRITER_GUARD_HELD`；CIM 枚举因 Access denied，完整 child oracle 未取得。 | 部分 PASS / CONCERNS |
| 临时 venv `python docs/contracts/validate_contracts.py` | Windows 路径 venv 首次被 Cygwin Python 拒绝；改 `/tmp` 后依赖安装因 maturin/rpds 不支持 `x86_64-cygwin` 失败；系统直接运行缺 `jsonschema`。因此未得到预期 10/42/66。 | BLOCKED-ENV |

复跑没有把准备失败隐藏为产品成功，也没有把 fake-harness 的 probe=HTTP_OK 当作真实 Harness probe。真实失败链本身证明 supervisor 的 spawn/exit/backoff 在 dshd 装配路径运作，但它不能证明认证、READY、generation 发布、N+1 或最终真实 Harness STOPPED。

## 6. 发现清单

### F01

- 维度：阶段目标达成 / 真实测试复跑
- 严重度：BLOCKER
- 位置：`scripts/run-m2-real-harness.mjs` 与当前 `dsh/` 冻结快照
- 原文：`generation 1 READY timeout`
- 问题：独立指定入口复跑无法找到 `dsh/apps/cli/lib/bin.js`，所有 child 在认证前退出，generation 保持 0；实现方声称的两代真实 probe 与 N+1 没有重现。
- 建议：在不修改冻结源码的可重复构建阶段生成并校验固定 CLI 产物，明确将 build artifact digest/入口存在性作为脚本前置门禁；在干净检出重新执行完整两代产品链并保存两代 PID、generation、exchange/probe 和 STOPPED 输出。

### F02

- 维度：交付物与计划符合度 / 代码评审
- 严重度：MAJOR
- 位置：`crates/dshd-adapters/src/files.rs`
- 原文：`if path.exists() { fs::remove_file(path)? }`
- 问题：更新 desired 时先删除旧文件再 rename，新旧值之间存在缺文件窗口；这不满足冻结计划的原子替换和崩溃后“旧或新完整文件”判据。
- 建议：采用平台正确的原子 replace 语义，并增加删除/rename/父目录同步各故障点与进程崩溃测试；不得靠启动时猜测恢复。

### F03

- 维度：交付物与计划符合度 / 代码评审
- 严重度：MAJOR
- 位置：`crates/dshd-adapters/src/files.rs` WriterGuard
- 原文：`OpenOptions::new().write(true).create_new(true)`
- 问题：哨兵文件不等价于 owner 持有的 OS lock。dshd 异常终止不会执行 Drop，stale `writer.lock` 会阻止合法 successor；现有双进程只证明并发 create 排他，没有证明 owner 生命周期、崩溃释放和 owner spawn。
- 建议：改用 Windows/Unix 对应的内核文件锁并绑定 RAII handle；增加 owner crash 后 successor 获取、owner 实际 child 存在、competitor 无 child/local/ready 的双 OS 进程 oracle。

### F04

- 维度：阶段目标达成 / 交付物与计划符合度
- 严重度：MAJOR
- 位置：`docs/milestones/m2/exit-record.md`
- 原文：`VM-01 | PASS | structural/check/clippy/test/drift/selftests/evidence 全绿`
- 问题：冻结标准要求干净 GitHub Actions 单次全绿，题设明确计费/runner 阻断。本地结构/check/selftests 不能冒充远端 CI，exit-record 的 AC-01/VM-01 PASS 口径不实。
- 建议：在外阻解除前改记 BLOCKED-EXTERNAL 并保留本地证据为补充；解除后记录同一 commit 的 run ID、jobs、退出码与 artifacts。

### F05

- 维度：代码评审
- 严重度：MAJOR
- 位置：`crates/dshd-adapters/src/supervisor.rs`
- 原文：`let _ = child.kill(); let _ = child.wait();`
- 问题：stop 没有实现冻结计划规定的先 graceful signal、8 秒超时、再 process-group kill 的有界升级；Unix 也未见独立 process group。当前 Windows typed shutdown 更接近直接强杀，不能充分证明 SIGTERM 语义。
- 建议：实现跨平台 process-group/job-object 生命周期，注入可测试 stop timeout，并用忽略终止 fixture 验证 TERM→timeout→KILL 与最终无孤儿。

### F06

- 维度：交付物与计划符合度 / 代码评审
- 严重度：MINOR
- 位置：`crates/dshd-core/src/state.rs` 与 `crates/dshd-adapters/src/coordinator.rs`
- 原文：`thread::spawn(move || { while let Ok(event) = rx.recv()`
- 问题：单 reducer 成立，但冻结计划要求的 ST 本地后果优先级穷举、队列异常安全态和 snapshot watch/broadcast 订阅没有充分实现或测试；当前消费者主要轮询 RwLock。
- 建议：补全 observed×stop/shutdown/fence 表、乱序/重复/队列关闭模型测试，并提供不可变 snapshot 订阅接口供后续健康/管理模块复用。

### F07

- 维度：真实测试复跑
- 严重度：INFO
- 位置：本机 Python 环境
- 原文：`Unsupported platform: x86_64-cygwin`
- 问题：临时 venv 无法安装锁定依赖，`validate_contracts.py` 未得到 10/42/66 输出；这是环境阻断，不应记产品 FAIL，也不能记 PASS。
- 建议：在支持 wheel 的 CPython/CI image 中用临时 venv 重跑并保存 validator 的 10/42/66 输出。

## 7. 无问题确认清单

- PASS：`dshd-core` 未发现 OS/文件/网络副作用，单 reducer 是唯一状态归约事实源。
- PASS：main 的 config→identity→desired→guard→coordinator→supervisor 装配顺序清晰，非法前置输入 fail-closed。
- PASS：未发现第二套 coordinator、控制 DTO、错误码清单或 66-vector manifest。
- PASS：Secret 不实现 Display，Debug 脱敏；token/cookie 未写入 identity/desired 文件，真实日志字段使用 REDACTED。
- PASS：子进程 env 对 KEY/SECRET/TOKEN/PASSWORD 名称做剥离，Harness telemetry 禁用变量明确设置。
- PASS：退避 1/2/4/8/16/30 秒有上限；fake/stub 瞬时 I/O 重试次数有限，未见无界 timeout 重试。
- PASS：Ready URL exact authority parser 拒绝 localhost，Bootstrap exchange/probe 使用同一 authority Host，probe 成功前 reducer 不发布 READY。
- PASS：fake fixtures 覆盖 ready-fragmented/delayed/malformed、token-rejected、probe-failed、crash 与 hang；reference stub 坦诚标注中央 behavior 未实现。
- PASS：runner 维持 `declared=66`，本次 `executed=4`，且 fake/stub self-test 均报告 vectors_executed=0。
- PASS：Cargo lock、生成链与 drift gate 未发现漂移；本任务未修改冻结文档、契约、实现、工具或 `dsh/`。
- PASS：实现方对中央注册/租约、M3 管理 API、M4/M5 HTTP/WS 透明代理、跨 task single-attach 等未实施范围有明确声明。

## 8. 下一步建议

本轮不得进入步骤 6 交付简报。必须先修复或补齐：

1. 让冻结 Harness 构建产物在干净检出可重复生成/取得，并由 dshd 装配路径重跑两代真实 PID、exchange=303、probe=HTTP_200、READY generation 1→2、crash/backoff、SIGTERM/STOPPED；该项是解除 BLOCKER 的首要条件。
2. 将 writer guard 改为真实 OS owner lock并补完整 CF-01 oracle；修复 desired/identity 原子替换的删除窗口。
3. 实现和验证有界 graceful stop/process group 语义，补齐 reducer 优先级、late fence、snapshot subscription 与 I/O 故障矩阵。
4. GitHub Actions 外阻解除后取得同一 commit 的单次全绿证据；在可支持依赖 wheel 的临时 CPython venv 重跑 `validate_contracts.py` 并取得 10/42/66。
5. 修订 exit-record，使 AC-01/VM-01、AC-03/VM-03 与真实证据一致；完成修复后开展独立验收 R2，而不是复用本报告中的失败运行或历史成功 transcript。
