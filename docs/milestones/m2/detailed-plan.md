# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-30 | Remote Agent | 将 M2 总体方案拆为依赖明确、可验证、可估算的实现 DAG，并给出交付物、AC/VM 与工程门禁矩阵。 | `docs/milestones/m2/six-elements.md`、`docs/milestones/m2/overall-plan.md` |

# M2「进程与认证」详细计划

## 1. 执行目标、口径与输入门禁

本计划供步骤 3 的远程实现 Agent 在 M1 已验收骨架中执行。目标是完成 D1～D9，使 config/identity、state coordinator、writer guard、supervisor、Harness bootstrap/auth、真实 Harness 接入与 ID/CF/ST 本地 runner driver 形成一条可重复证据链。出口原文保持：**“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”**。

开始 T01 前必须核对[冻结六要素](docs/milestones/m2/six-elements.md)、[总体方案](docs/milestones/m2/overall-plan.md)、[服务设计](docs/dshd-service-design.md)、[节点 HLD](docs/backend-node-hld.md)、[一致性向量](docs/contracts/central-dshd-conformance.md)、[OpenAPI](docs/contracts/central-dshd-openapi.yaml)、[Harness 基线](docs/dsh/harness-version-baseline.md)及 M1 exit evidence。发现摘要或范围不一致即停止，不自行解释为解冻。

任务状态采用 `NOT_STARTED|IN_PROGRESS|BLOCKED|DONE`。`DONE` 只表示该任务“完成判据”和列出的验证均有机器结果；代码编译、工具自检或人工审查单独通过不足以替代行为 oracle。人日是单人等效工程量，不是日历承诺；可按 DAG 并行，但依赖边不得绕过。总估算 31.0 人日，处于冻结要求建议的 20～35 人日范围。

## 2. 任务总表与依赖 DAG

| 编号 | 名称 | 直接依赖 | 主要交付物 | 完成判据摘要 | 人日 |
| --- | --- | --- | --- | --- | ---: |
| T01 | 冻结输入与 M1 接口审计 | 无 | D1～D9 共用 | 摘要、版本、边界、扩展点与测试现状记录完整 | 1.0 |
| T02 | config 与 identity 领域规则 | T01 | D1 | ID-01/02 纯规则正反例全绿，无 OS 副作用 | 1.5 |
| T03 | identity/desired 原子文件 adapter | T02 | D1、D2 | create-if-absent、fsync/rename、权限与损坏反例通过 | 2.0 |
| T04 | writer guard 与双进程 oracle | T01 | D2 | CF-01 中竞争者无 spawn 并报规定错误 | 1.5 |
| T05 | 状态模型、事件与纯 reducer | T02 | D3 | desired/observed 正交、迁移与优先级表穷举通过 | 2.5 |
| T06 | coordinator effect loop 与 snapshot | T03、T05 | D3 | 单写、晚到结果 fence、原子发布与取消可验证 | 2.0 |
| T07 | supervisor 进程与退避 adapter | T04、T06 | D4 | spawn/exit/timeout/process group/退避确定可测 | 2.5 |
| T08 | stop、shutdown、隔离与恢复 reconcile | T03、T06、T07 | D3、D4 | ST-05/06/11/13/14 本地链收敛，旧代不复活 | 2.5 |
| T09 | ready URL 与 exact authority parser | T01 | D5 | 合法 URL 唯一接受，恶意/歧义/localhost 反例拒绝 | 1.0 |
| T10 | cookie exchange、probe 与 context | T06、T09 | D5 | probe 后才 READY，secret 仅内存，晚到认证无效 | 2.0 |
| T11 | fake Harness M2 fixtures | T07、T09、T10 | D7 | ready/auth/probe/crash/挂起场景确定且自检通过 | 1.5 |
| T12 | reference stub 本地输入 driver | T06、T08 | D7 | 只注入不可达/明确隔离等事件，不实现中央业务 | 1.0 |
| T13 | dshd 装配与健康观测接线 | T03、T04、T06、T08、T10 | D1～D5 | 启动顺序 fail-closed，snapshot 驱动 local/ready 观测 | 2.0 |
| T14 | 冻结真实 Harness 集成 | T11、T13 | D6 | 固定快照启动→认证→probe→READY→停止成功 | 2.0 |
| T15 | runner driver 与诚实报告 | T11、T12、T13 | D8 | 本地子集真实执行；66 声明不变；负测能失败 | 2.0 |
| T16 | capability evidence 与 M2 CI | T14、T15 | D9 | 证据位校验、五层 jobs、`--locked` 全绿 | 1.5 |
| T17 | 并发/故障/secret 强化验收 | T14、T16 | D1～D9 | 竞态、损坏、崩溃、日志/文件扫描无开放缺陷 | 1.5 |
| T18 | 干净运行、出口记录与移交 | T17 | D1～D9 | AC-01～07、VM-01～06 全部有 artifact 并签核 | 1.0 |

```text
T01 ─┬─ T02 ─ T03 ───────────────┐
     │      └─ T05 ─ T06 ────────┼─ T08 ─────────────┐
     ├─ T04 ───────── T07 ────────┘                   │
     └─ T09 ───────────── T10 ─ T11 ───────┐          │
                          T12 ◀─ T06,T08    ├─ T15 ─┐ │
T03,T04,T06,T08,T10 ─────────────── T13 ───┤       │ │
T11,T13 ───────────────────────────── T14 ──┘       ├─ T16 ─ T17 ─ T18
T12,T13 ─────────────────────────────────── T15 ────┘
```

关键路径按工程依赖为 `T01 → T02 → T05 → T06 → T07 → T08 → T13 → T14 → T16 → T17 → T18`；T03、T04、T09 可在各自前置后并行，T11 与 T12 分别服务进程异常和外部结论注入。任何并行都不能跳过 T06 的单 coordinator 约束，也不能在 T14 前把 fake PASS 当作真实兼容证明。

## 3. 分任务执行说明

### T01 冻结输入与 M1 接口审计

- 依赖：无。
- 完成判据：记录六要素 SHA-256、M1 接收 commit、Rust `1.89.0`、Cargo.lock 摘要、66 向量分组、Harness tag/commit/tree/lock、Node/pnpm 版本；列出每个 `NOT_IMPLEMENTED` 模块、现有 trait/CLI/report schema、可复用测试入口；确认 `dsh/` 与契约零改动基线。
- 实现要点（数据/状态/接口）：建立只读审计表，将 D1～D9 映射到现有 crate/tool 文件；标记 OpenAPI 生成类型是控制 DTO 唯一来源；列出 M2 可执行候选与必须保持 declared 的条目，不预填 executed 数。
- 验证方式：contract——运行现有契约 validator 与 drift gate；集成——运行 fake/stub/runner/report 的 M1 `--self-test`；审查 git path diff、工具版本和摘要。此任务不修改产品行为。
- 预计工期：1.0 人日。

### T02 config 与 identity 领域规则

- 依赖：T01。
- 完成判据：合法默认/非默认 listener 和端口映射输入可形成不可变配置；缺失 endpoint、userinfo/path/query/fragment、端口 `<1024` 或 `>65535`、已有 identity.node_id mismatch 全部在副作用前失败；只允许生成 storage_id。
- 实现要点（数据/状态/接口）：在 `dshd-core` 定义 validated config、NodeIdentity、IdentityDecision 与稳定错误类别；构造函数一次完成规范化和拒绝规则，禁止下游接触未经验证字符串。secret 使用不可 Debug/Display 的包装；identity 不含 cookie、launch token 或后续阶段事实。
- 验证方式：unit——表驱动 URL、端口、node_id、UUIDv4；contract——逐项映射 ID-01、ID-02 的输入和必须观察结果；负例断言未产生 Listen/AcquireGuard/Spawn effect。
- 预计工期：1.5 人日。

### T03 identity/desired 原子文件 adapter

- 依赖：T02。
- 完成判据：空卷 create-if-absent，重启读到同一 storage_id；竞争初始化只有一个事实；已有 mismatch 不覆盖；desired 缺失原子创建默认 RUNNING，STOPPED 持久后重启保持；临时写、flush、fsync、rename、父目录同步与权限失败均 fail-closed。
- 实现要点（数据/状态/接口）：文件格式带 schema version；目录 `0700`、文件 `0600`；同目录临时文件避免跨文件系统 rename；解析拒绝 unknown/损坏状态而不猜测。IdentityStore 与 DesiredStore 实现 core port，测试根目录可注入，生产默认 `/var/lib/dsh/dshd`。
- 验证方式：unit——序列化、版本、权限、损坏 JSON；adapter——每个 I/O 故障点注入；集成——进程崩溃前后只出现旧或新完整文件；runner——为 ID-01/02、ST-01/06 提供持久层证据。
- 预计工期：2.0 人日。

### T04 writer guard 与双进程 oracle

- 依赖：T01。
- 完成判据：同一 volume 两个 dshd 竞争，只有一个持有 writer guard 并可继续 spawn；另一个报告 `WRITER_GUARD_HELD`，无 child PID、不可 local/ready；拥有者关闭后 guard 按定义释放。不同测试根互不干扰。
- 实现要点（数据/状态/接口）：在 adapter 封装 flock/等价非阻塞锁与 RAII guard，清晰记录所有权；获取顺序位于配置/identity 校验后、任何子进程前。验证 `--no-fork`/fd 继承对实际所有权的影响；本地锁绝不被描述为跨 task single-attach。
- 验证方式：unit——错误映射与 guard 生命周期；集成——真实两个 OS 进程、共享目录、PID 观测；runner——CF-01 driver；负测强制移除锁应让 oracle 失败。
- 预计工期：1.5 人日。

### T05 状态模型、事件与纯 reducer

- 依赖：T02。
- 完成判据：desired state 与 observed state 为独立字段；STARTING/AUTHENTICATING/READY/UNHEALTHY/STOPPING/STOPPED/FENCED 的合法迁移、非法迁移、优先级和 effects 表可穷举；同一输入 snapshot+event 得到确定输出。
- 实现要点（数据/状态/接口）：定义 immutable Snapshot、Event、Effect、AttemptId、Generation、错误原因和阶段；优先级固定为明确 FENCED/container shutdown 高于已接受操作，高于自动恢复。M2 的操作仅是内部测试/未来 management 端口命令，不实现 operation store。wall clock 只用于显示，退避与 timeout 使用可注入 monotonic clock。
- 验证方式：unit——状态转换表、属性测试、非法路径、重复/乱序/晚到事件；contract——映射 ST-01、03、04、05、06、07、08、10、11、12、13、14 的本地后果；ST-02/09 仅登记后续依赖。
- 预计工期：2.5 人日。

### T06 coordinator effect loop 与 snapshot

- 依赖：T03、T05。
- 完成判据：单一有界队列串行处理 typed event；只有 coordinator 可更新 snapshot；先生成新状态再发布 effects，持久化成功后才产生进程副作用；旧 attempt 的 auth/exit/timer 结果被丢弃；ready/context 撤销与拒绝新取得处于同一迁移。
- 实现要点（数据/状态/接口）：将 reducer 与 effect executor 分开；effect completion 回送事件而不直接写状态；watch/broadcast 只发布 immutable snapshot。队列满、consumer 消失、持久化失败进入明确定义的安全态。记录 sequence 便于 transcript，但 sequence 不替代 generation。
- 验证方式：unit——可控 executor 与虚拟时钟；并发——随机事件调度、晚到 BootstrapSucceeded、stop/crash 同时发生；集成——snapshot 订阅者从不观察半迁移；contract——ST-10 本阶段只验证 context 门闩。
- 预计工期：2.0 人日。

### T07 supervisor 进程与退避 adapter

- 依赖：T04、T06。
- 完成判据：仅在持 guard、desired=RUNNING、未 shutdown/隔离时 spawn；管理独立 process group、stdout/stderr、ready timeout、exit status；崩溃后有界指数退避且可取消；终止超时后按设计升级；无僵尸与孤儿子进程。
- 实现要点（数据/状态/接口）：ProcessSpec 固定可执行程序、参数、cwd、env allowlist 与只读运行目录；禁止 shell 拼接。BackoffPolicy 使用可测试参数、上限和 monotonic timer。所有输出关联 attempt id，日志限制大小并脱敏。
- 验证方式：unit——退避序列、上限、取消；adapter——fake 子进程立即退出、挂起、忽略 SIGTERM、分片 stdout；集成——父进程关闭后 process group 收敛；ST-05 的 N+1 由后续 T08/T11 验证。
- 预计工期：2.5 人日。

### T08 stop、shutdown、隔离与恢复 reconcile

- 依赖：T03、T06、T07。
- 完成判据：crash 先撤 ready/context 再恢复，成功后发布 N+1；stop 先 durable desired=STOPPED，再取消 STARTING/AUTHENTICATING/UNHEALTHY recovery，经 STOPPING 有界 STOPPED；重启不自启；明确隔离与 shutdown 在任意非 STOPPED 状态优先收敛且 desired 保留。
- 实现要点（数据/状态/接口）：把“持久意图提交”和“进程 effect”分两阶段；generation 仅在成功认证探测的新 context 发布时递增，不按 spawn attempt 递增。隔离输入只来自 typed stub/event，M2 不自行推断中央结论。SIGTERM 的生产超时遵循 8 秒升级与至少 15 秒容器 grace，测试参数可缩短但语义一致。
- 验证方式：unit——所有 observed state × stop/shutdown/fenced 矩阵；集成——ST-05、06、11、13、14；重启读取 desired；并发——慢 auth 成功晚于 stop 时不能 READY；runner 保存每步 snapshot 和 PID。
- 预计工期：2.5 人日。

### T09 ready URL 与 exact authority parser

- 依赖：T01。
- 完成判据：只接受冻结格式的 loopback HTTP ready URL 与唯一 token；拒绝 localhost、IPv6/其他地址、userinfo、歧义端口、重复 token、额外敏感组件、超长/分片未完成输入；解析输出 exact authority 与 secret wrapper。
- 实现要点（数据/状态/接口）：parser 在 core 纯实现，stdout framing/限长/超时在 adapter；authority 不做会改变 Host 的二次解析或 DNS 替换。错误仅含类别和安全位置，不回显原 URL/token。
- 验证方式：unit——等价类、边界、恶意字符串、fuzz/proptest；contract——PX-01、PX-02 的认证前置；adapter——分片、多个候选行、EOF 与超时。
- 预计工期：1.0 人日。

### T10 cookie exchange、probe 与 context

- 依赖：T06、T09。
- 完成判据：exchange 与 probe 均使用 exact Host；cookie 绑定 authority+attempt，只驻内存；probe 成功前不发布 READY/generation；失败或取消销毁 secret；晚到成功不能覆盖新 attempt；日志和持久目录扫描无 token/cookie。
- 实现要点（数据/状态/接口）：BootstrapClient 接口只暴露 typed success/failure，不向 coordinator 暴露原始 token；ConnectionContext 发布后不可变，含 authority、origin、cookie、generation。客户端显式禁止 redirect、自动 host 替换与重试；M2 只调用认证所需最小端点，不构建透明转发层。
- 验证方式：unit——cookie scope、redaction、context equality；contract——PX-01 成功与 PX-02 localhost 失败；integration——token 拒绝、cookie mismatch、probe 失败/超时、stop 取消；secret 扫描。
- 预计工期：2.0 人日。

### T11 fake Harness M2 fixtures

- 依赖：T07、T09、T10。
- 完成判据：工具支持正常 ready/exchange/probe，ready 分片/延迟/畸形/恶意 authority、token 拒绝、cookie scope 不匹配、probe 失败、立即/延迟 crash、忽略终止等确定场景；每项有 seed、期望 transcript、版本与自检。
- 实现要点（数据/状态/接口）：沿用 M1 CLI/scenario/report 结构，不复制产品 parser；随机端口仅绑定 loopback；测试 cookie 的作用域事实。fixture 自检只证明 fake 自身，报告中不增加 runner executed。
- 验证方式：unit——scenario 解析；contract——ready/cookie/probe 捕获内容；integration——dshd 对每种 fixture 的状态序列；工具 `--version`/`--self-test`。
- 预计工期：1.5 人日。

### T12 reference stub 本地输入 driver

- 依赖：T06、T08。
- 完成判据：可确定注入中央不可达、恢复提示、明确 STALE/FENCED 等 M2 所需事件并记录脱敏 transcript；不实现中央持久权威、续租算法或完整注册行为；driver 能断言 dshd 的本地后果。
- 实现要点（数据/状态/接口）：复用 M1 fixture 和版本协议，以场景文件描述输入时间与期望 snapshot；将尚属 M6 的判断作为预置 oracle 结果，而不是在 stub 内宣称产品完成。输入必须携带 attempt/instance 关联，乱序事件由 coordinator fence。
- 验证方式：unit——fixture schema 和次序；integration——ST-03/04/13 的本地收敛；边界审查确保没有生产 Central Client 接线；self-test 不计行为通过。
- 预计工期：1.0 人日。

### T13 dshd 装配与健康观测接线

- 依赖：T03、T04、T06、T08、T10。
- 完成判据：main 严格按 config→identity→desired→guard→coordinator→listener/supervisor 顺序装配；非法输入在 listener/spawn 前退出；local 只反映本地 Harness 可用，ready 还受本阶段注入 registration 状态约束；shutdown 等待任务和 child 收敛。
- 实现要点（数据/状态/接口）：main 只构造 adapter、channel、取消树和 signal handler。health 读取同一 snapshot，不另建状态；M2 可提供测试专用内部 command port 或 fixture 文件，生产管理路由保持未实现。错误输出稳定、脱敏并可由 runner 捕获。
- 验证方式：unit——装配配置；integration——空卷、已有卷、guard 冲突、中央不可达输入、正常 auth、shutdown；contract——ID-01/02、CF-01、ST-01/07；检查无第二套 DTO。
- 预计工期：2.0 人日。

### T14 冻结真实 Harness 集成

- 依赖：T11、T13。
- 完成判据：核对固定 tag/commit/tree/lock 和工具链；依赖以 frozen lock 安装于构建/CI 层，`dsh/` 保持零 diff；dshd 使用固定 `dsh web --no-open --port 0` 启动，解析真实 stdout，完成真实 exchange/probe，发布 READY；stop 与一次 crash recovery 链有证据。
- 实现要点（数据/状态/接口）：工作区和持久目录使用测试临时路径，源码快照只读；运行期不下载。将 fake 与真实 job 分离，真实 job 输出进程版本、基线摘要、PID、脱敏 authority、状态序列和 generation，不输出 secret。
- 验证方式：integration/e2e——真实启动→AUTHENTICATING→READY→终止 child→退避→READY N+1→SIGTERM→STOPPED；文件 hash 与 git diff 验证只读；失败不得用 fake 结果替代。
- 预计工期：2.0 人日。

### T15 runner driver 与诚实报告

- 依赖：T11、T12、T13。
- 完成判据：manifest 仍精确 66；只把已有实际 driver 的 M2 本地场景标记可执行；每次运行动态统计 executed/passed/failed，逐项写 command、环境、commit、输入摘要、退出码和 artifact；JSON/JUnit/人读一致；破坏产品 oracle 时退出非零。
- 实现要点（数据/状态/接口）：driver 通过公共进程/fixture 接口启动 dshd，不调用私有 reducer 冒充 e2e。ID/CF/ST 中需要后续完整中央或管理面的场景保留 declared；一个向量仅有 unit 覆盖也不提升。报告区分 `DECLARED`、本次 executed、passed、failed、skipped reason。
- 验证方式：unit——计数、未知/重复 ID、artifact schema；contract——66 分组 4/4/14/13/13/15/3；integration——本地 driver；负测删除证据、让 assertion 失败、让 driver 未运行，均不得报 PASS。
- 预计工期：2.0 人日。

### T16 capability evidence 与 M2 CI

- 依赖：T14、T15。
- 完成判据：capability-report 为 D1～D8 的本地能力登记证据位，缺 artifact/digest/environment 时失败；CI 分层执行 format、lint、check、unit、contract、fake/stub integration、真实 Harness、runner 和 secret scan；全部 Cargo 命令 `--locked`。
- 实现要点（数据/状态/接口）：沿用 M1 报告中间模型，增加 DSHD identity/state/process/auth 能力，不把 WUI 或 OUT 项误算覆盖。job artifact 命名包含 commit、工具版本和场景；真实 job 明确 frozen install 与只读快照。
- 验证方式：unit——报告 schema 正反例；CI contract——required job 与依赖关系；集成——空证据位/摘要错配负测；完整流水线在同一 commit 运行。
- 预计工期：1.5 人日。

### T17 并发、故障与 secret 强化验收

- 依赖：T14、T16。
- 完成判据：双进程竞争、并发 identity create、desired 写中断、stdout 分片/洪泛、crash/stop/auth 竞态、忽略终止、重复/乱序事件均无旧代复活或半文件；日志、JSON/JUnit、临时目录、持久目录中无 launch token/cookie；无未关闭 P0/P1。
- 实现要点（数据/状态/接口）：使用确定 seed 和虚拟时钟减少 flaky；真实 OS 竞态与模型测试互补。失败保留原始脱敏 artifact，并区分产品缺陷、fixture 缺陷和环境阻塞；修复后重跑受影响层及完整汇合链。
- 验证方式：unit/property、adapter 故障注入、integration 压力循环、runner 反例、secret pattern 扫描；对每个 AC 提供至少一个负向证明。
- 预计工期：1.5 人日。

### T18 干净运行、出口记录与移交

- 依赖：T17。
- 完成判据：从干净检出用锁定输入完成一次全绿；AC-01～AC-07、VM-01～VM-06 每项均为 PASS 并链接原始 artifact；`dsh/`、契约、M1 冻结文档零 diff；记录真实 executed 子集与仍 declared 清单；形成 M3 可消费接口说明。
- 实现要点（数据/状态/接口）：exit record 固定 commit、Rust/Cargo、Cargo.lock、Harness 摘要、工具版本、环境、命令和退出码。明确 M2 未实现中央客户端、管理面、透明传输和跨节点保证。失败记录不删除，不拼接多个 run。
- 验证方式：五层测试全量；真实 Harness e2e；runner/report；git path 审计；按路线图门禁逐字签核。任何缺证据条目为 FAIL/BLOCKED，不得条件通过。
- 预计工期：1.0 人日。

## 4. D1～D9 完成矩阵

| 交付物 | 主实现任务 | 集成/强化任务 | 汇合任务 | 完成定义 |
| --- | --- | --- | --- | --- |
| D1 配置与身份真实化 | T02、T03 | T13、T17 | T18 | ID-01/02 本地路径、原子身份与 fail-closed 有机器证据 |
| D2 原子状态与单写基础 | T03、T04 | T13、T17 | T18 | durable desired 与 CF-01 双进程 oracle 同时成立 |
| D3 state coordinator | T05、T06 | T08、T12、T13、T17 | T18 | 单 reducer、typed effect、snapshot 与优先级无旁路 |
| D4 supervisor/reconcile | T07、T08 | T11、T13、T14、T17 | T18 | crash recovery、N+1、stop/shutdown 有界且旧代不复活 |
| D5 认证引导 | T09、T10 | T11、T13、T14、T17 | T18 | ready URL、cookie、probe、exact authority 与 secret 门禁通过 |
| D6 真实 Harness | T14 | T16、T17 | T18 | 固定只读快照的启动、认证、恢复、停止真实成功 |
| D7 fake/stub 增量 | T11、T12 | T15、T17 | T18 | 异常 fixture 与外部输入可复现，且无越界产品声明 |
| D8 runner | T15 | T16、T17 | T18 | 66 declared 保持，真实执行动态计数与逐项 artifact 一致 |
| D9 evidence/CI/exit | T16 | T17 | T18 | 五层门禁和 AC/VM 索引完整、可追踪、无虚假覆盖 |

矩阵的“主实现任务”完成不代表交付物完成；只有汇合任务 T18 对所有上游证据签核后，D 项才可标 DONE。若 D6 的真实快照环境不可用，D6、依赖它的 AC-03 和总门禁必须 BLOCKED，不能以 D7 替代。

## 5. 验收标准、VM 与出口门禁映射

### 5.1 AC 映射

| AC | 冻结标准的执行口径 | 任务 | 必须保存的 evidence |
| --- | --- | --- | --- |
| AC-01 | 干净检出后 build/lint/typecheck/unit/contract 在同一次 CI 全绿 | T16～T18 | run ID、commit、无缓存说明、全部 job 原始日志 |
| AC-02 | 同卷双实例只有首个持 guard 并 spawn，竞争者 `WRITER_GUARD_HELD` 且非 local/ready | T04、T13、T17、T18 | 两 PID、共享路径、锁所有权、child 列表、状态与错误 transcript |
| AC-03 | 冻结真实 Harness 完成 ready/auth/probe/READY，crash 后退避并发布 N+1 | T07、T08、T10、T14、T17 | 基线摘要、状态时间线、两代 PID/generation、真实 probe 输出 |
| AC-04 | desired/observed 正交；STOPPED 重启不 spawn；SIGTERM 有界 STOPPED 且 desired 保留 | T03、T05、T08、T13、T17 | ST-06/14 报告、前后文件、snapshot、时限 |
| AC-05 | localhost/非 exact authority 不能 READY；launch token/cookie 不落盘不入日志 | T09～T11、T14、T17 | PX-01/02 认证结果、Host 捕获、secret scan |
| AC-06 | 非法 endpoint/node_id 在 listener/spawn 前退出且不覆盖 identity | T02、T03、T13、T17 | ID-02 参数矩阵、端口/PID 证明、identity 前后 hash |
| AC-07 | ID/CF/ST 本地子集由 runner 真执行；其余 declared；总声明 66 | T12、T15～T18 | manifest 摘要、三种报告、逐项 artifact、负测失败结果 |

### 5.2 VM 映射

| VM | 验收方法 | 执行任务与判定 |
| --- | --- | --- |
| VM-01 | 干净环境完整 CI | T18 从新检出使用锁定依赖；必须单次全绿，不拼接 |
| VM-02 | 单写竞争实测 | T04/T17 启动同卷双 OS 进程，核对 child、guard、local/ready 与错误 |
| VM-03 | 真实进程启动、认证、探测、崩溃恢复 | T14/T17 使用冻结快照跑完整状态时间线并保存脱敏输出 |
| VM-04 | runner executed/declared 核对 | T15/T18 对三种报告和逐项 evidence 交叉校验，故意破坏 oracle 必须非零退出 |
| VM-05 | identity/state/persistence 反例 | T02/T03/T06/T17 注入非法输入、损坏 desired、并发写、I/O 中断和晚到事件 |
| VM-06 | 路线图出口逐条记录 | T18 按 AC-01～07 与诚实边界签核，记录未实施项和 M3 移交面 |

出口记录只能在 AC-01～AC-07 与 VM-01～VM-06 全部 PASS 时引用：“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”。其中任何真实上游、锁竞争、secret 或 executed 证据缺失，都不能以代码审查、unit test 或 self-test 代替。

## 6. 工期、并行建议与关键风险缓冲

任务等效总工期为 31.0 人日：冻结与领域/持久基础 T01～T06 为 10.5；进程与认证 T07～T10 为 8.0；验收资产、装配与 runner T11～T15 为 8.5；CI、强化和出口 T16～T18 为 4.0。建议两条并行流：A 流承担 T02～T08 的状态/进程链，B 流承担 T09～T12 的认证/fixture 链；T13 汇合，T14 后不再并行拆分真实出口判断。

估算已包含约 3 人日故障注入与干净环境缓冲，但不包含冻结语义变更、Harness 升级、目标 ECS 调试或后续里程碑实现。若发现必须改变六要素或上游基线，立即标 BLOCKED 并走解冻确认，不消耗缓冲偷偷扩项。

## 7. 给实现 Agent 的工程纪律

1. 先读冻结输入再改代码；每个 PR/提交只覆盖 DAG 中一个可审查切片，提交信息包含 Txx 与 D 映射。不得推送远端。
2. 只在 M1 既有 crate、tool 和测试层内增量真实化；core 保持纯领域，OS/文件/进程/本地网络属于 adapter，main 只装配。不得建立第二套 coordinator、DTO、错误码或 vector manifest。
3. 五层测试不可合并口径：领域 unit、adapter unit、contract、fake/stub integration、真实 Harness/runner e2e。工具 `--self-test` 只验证工具自身，不计产品行为。
4. 所有 Cargo 命令使用 `--locked`；沿用 Rust 1.89.0 与现有 `Cargo.lock`。未经冻结变更不得升级工具链、生成器或上游依赖。
5. 真实 Harness 只从固定 `dsh/` 快照与 frozen lock 安装，保持源码只读；运行 profile 固定 `dsh web --no-open --port 0`；禁止运行期下载、`npx` 或安装依赖。
6. secret、launch token、cookie 使用不可 Debug/Display 类型，只驻内存；任何日志、错误、报告、JUnit、临时文件与持久文件均不得出现。失败 artifact 也必须脱敏。
7. desired 必须先 durable 再产生生命周期副作用；observed 只能由 coordinator reducer 改变。writer guard 必须在 spawn 前取得，本地 flock 不得冒充部署层排他。
8. generation 只在新 context 经 exchange+probe 成功并原子发布时递增；每个异步结果携带 attempt fence。stop、shutdown、明确隔离后的晚到成功一律丢弃。
9. runner 的 `declared=66` 始终保持。只有 driver 实际运行产品路径、oracle 通过并写出 artifact 的条目才计 executed；依赖中央、管理面或透明通道的场景继续 declared，不预设一个好看的执行数。
10. 不修改 `dsh/`、冻结契约、M1 文档或检查器来配合实现。生成物只能由既有生成链产生，drift 必须由 gate 检出。不得通过放宽测试、延长无界 timeout 或跳过真实 job 获得绿色。
11. 每份证据记录 commit、UTC、环境、工具版本、输入摘要、命令、退出码和 artifact digest。失败保留并解释；修复后产生新的完整 run，禁止拼接。
12. M2 范围止于本地进程与认证。中央客户端归 M6，管理 operation/idempotency 归 M3，HTTP/WS 透明能力归 M4/M5，跨节点排他归部署层；M2 只保留 typed port 和输入 fixture，不实施这些能力。

## 8. 失败处理与回退规则

| 失败点 | 正确处理 | 禁止处理 |
| --- | --- | --- |
| 原子文件故障后出现半状态 | 修复提交协议，增加故障点测试，从旧完整值恢复 | 启动时猜测或静默覆盖 |
| 状态竞态或晚到结果复活 | 回到 reducer/effect fence，增加确定调度用例 | 在各模块散加共享锁 |
| guard 竞争仍产生 child | 阻断 CF-01，修复所有权/启动顺序并重跑双进程 | 只隐藏 health 或错误输出 |
| authority 负例通过 | 阻断认证发布，修复 parser/Host 复用 | 用 DNS 等价解释 localhost |
| fake PASS、真实失败 | D6 与 AC-03 保持 FAIL/BLOCKED，调查兼容差异 | 用 fake artifact 替换真实证据 |
| runner 数字与 artifact 不一致 | 动态重算，缺证据条目回退 declared | 人工修改 JSON/JUnit 数字 |
| secret scan 命中 | 删除不安全 artifact、修复 redaction、轮换测试 secret、全链重跑 | 仅把扫描规则排除该路径 |
| 发现后续阶段需求 | 保留接口占位并登记移交 | 在 M2 顺手实现外部 API/代理/中央逻辑 |

## 9. 最终移交清单

T18 交付给 M3 的包必须包含：D1～D9 状态矩阵；AC/VM exit record；真实 Harness 基线与运行 transcript；runner manifest 摘要、实际 executed 子集、仍 declared 清单；状态事件、snapshot、lifecycle command 与 ConnectionContext 的接口说明；所有已知限制和失败记录。工作区必须无 `dsh/`、契约、M1 文件或其他越界改动。

移交声明必须明确：M2 证明的是 dshd 本地进程管理、认证引导及相应 runner 场景；66 向量没有被宣称全部通过，中央裁决只是测试输入，管理面与透明传输尚未实现。M3 应复用同一 desired/observed 状态机和命令端口接入管理语义，不能重新定义事实源。
