# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.1 | 2026-08-30 | Agent（一致性维护） | 修复 5 处本地 Markdown 链接为正确相对路径（冻结语义不变，一致性维护）。 |
| v1.0 | 2026-08-30 | Remote Agent | 将已冻结的 M2「进程与认证」六要素细化为可由步骤 3 实现 Agent 执行的总体方案；不改变目标、边界、约束、交付物或验收含义。 | `docs/milestones/m2/six-elements.md` v1.0 |

# M2「进程与认证」总体方案

## 1. 定位、结论与从属关系

M2 直接承接已通过人工验收的 M1 工程与验收骨架，把其中明确标记为 `NOT_IMPLEMENTED` 的 config、identity、state、supervisor、harness 及相应验收 driver 首次真实化。M2 的结果不是增加管理面、透明转发或中央客户端，而是在单容器、单 active Harness、单持久卷的边界内，使 dshd 能从持久 desired state 出发，取得本地单写权，初始化身份，启动并认证固定 Harness，形成可撤销的 generation 上下文，并在崩溃、停止、重启、明确隔离输入和容器关闭时可靠收敛。

范围的最高权威是[冻结六要素](six-elements.md)。架构细化服从[服务设计](../../dshd-service-design.md) §8、§9、§10 与 §17，节点与容器边界服从[后端节点 HLD](../../backend-node-hld.md)，行为 oracle 服从[一致性向量](../../contracts/central-dshd-conformance.md)，控制类型服从[OpenAPI](../../contracts/central-dshd-openapi.yaml)，真实上游服从[Harness 冻结基线](../../dsh/harness-version-baseline.md)。若本文与任一冻结输入冲突，以冻结输入为准，本文不得成为第二套契约。

M2 位于 `M0 → M1 → M2 → M3 → {M4,M5,M6} → M7 → M8` 的第二个实现里程碑。它只为 M3 提供稳定的本地进程、认证、状态与证据基础，不预先实现 M3 的管理面 operation/idempotency，不实现 M4/M5 的 HTTP proxy 或 WebSocket 数据通道，也不实现 M6 的 register、heartbeat、lease 客户端。后续阶段只能消费 M2 发布的 typed snapshot、生命周期命令端口和不可变 connection context，不能绕过 state coordinator 直接改状态。

## 2. 目标与冻结六要素对齐

| 目标 | M2 可观察结果 | 主要向量 | 不越界说明 |
| --- | --- | --- | --- |
| 首次身份置备 | 空白卷严格校验 node_id、secret、监听端口、advertise 与 central 基址；只生成 storage_id；identity 以 create-if-absent、临时文件、fsync、原子 rename 落盘 | ID-01、ID-02 | 不实施 token enrollment 或中央绑定裁决 |
| 单写保障 | dshd 在任何 Harness 副作用前持有 writer guard；竞争者不 spawn、不成为 local/ready，并报告 `WRITER_GUARD_HELD` | CF-01 | flock 只解决同一挂载内竞争，不冒充部署层 single-attach |
| 状态协调 | desired state 与 observed state 正交；typed event 由单一归约器串行处理；每次有效迁移发布不可变 snapshot | ST-01、ST-03～08、ST-10～14 的 dshd 侧 | STALE/FENCED 等中央结论只作为注入事件，不在 M2 自行裁决 |
| 进程守护 | supervisor 按 desired reconcile，受控 spawn、退避、超时、process group signal；crash recovery 产生 N+1 generation | ST-05、ST-06、ST-11、ST-13、ST-14 | 不提供外部管理 API；测试 driver 通过内部命令端口触发 |
| 认证引导 | 从 stdout 有界解析 ready URL；只接受 loopback exact authority；launch-token 换取 authority-bound cookie；probe 成功后才 READY | PX-01、PX-02 的认证部分 | 不实现透明请求/响应或双向隧道 |
| 真实 Harness 接入 | 使用只读快照与冻结依赖闭包执行 `dsh web --no-open --port 0`，完成启动、认证、探测、守护和停止 | M2 出口门禁、ST-05 | 不修改 `dsh/`，不在运行期安装依赖 |
| 真实执行证据 | runner 对实际存在 driver 且断言通过的 ID/CF/ST 本地子集记 `executed`，报告逐场景 artifact | 六要素 §6.7 | 66 个声明保持完整；依赖后续能力者继续 `declared` |

本阶段的总成功条件逐字服从路线图：**“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”**。这里“连接”必须包含 exact authority、cookie exchange 和 probe 的机器证据；“可靠管理”必须包含单写、持久 desired、generation、崩溃恢复与有界关闭；“可执行”必须是 driver 真正运行并断言，而不是清单存在或工具自检。

## 3. 整体工作方法落地

| 冻结方法 | 实施顺序 | 过程门禁 | 出口证据 |
| --- | --- | --- | --- |
| 固定上游 | 先核对 tag、commit、tree、lock hash、Node 24、pnpm 11.7.0 与启动 profile，再安装冻结依赖 | 任一摘要漂移即停止，不用新版本继续 | 基线核对记录、只读检查、真实启动 transcript |
| 契约优先 | 先将 ID/CF/ST/PX 认证 oracle 写成测试矩阵，再实现领域归约与 adapter | 每个状态或错误必须追溯到冻结向量；不新造 DTO | unit、contract、runner 的同一场景 ID |
| 模块边界先行 | core 中放纯状态、配置和命令；adapter 中放文件、锁、进程、stdout 与本地 HTTP 客户端；main 只装配 | core 不依赖 OS/transport；其他模块不能写共享状态 | 依赖方向检查与模块级测试 |
| 分层增量 | config/identity → persistence/guard → state → supervisor → auth → fake/stub →真实上游→runner/report | 每层先完成负例和失败收敛，再允许后一层接线 | 分层测试记录与 DAG 完成判据 |
| 黑盒集成 | fake Harness 做确定性异常注入，冻结真实 Harness 证明兼容 | fake 自检不得充当产品行为；真实接入不得只跑 happy path | fake transcript 与真实 transcript 分开保存 |
| 诚实计数 | manifest 始终枚举 66；只有执行过产品路径且有 oracle 的条目才进入 executed | driver 缺失、跳过、依赖后续阶段均不得计 executed | JSON/JUnit/人读报告三者计数一致 |
| 门禁推进 | 每个任务提交前跑受影响层，汇合后跑五层检查和完整 M2 场景 | 禁止拼接多次失败/成功输出冒充一次全绿 | 单次干净运行、exit record 索引 |

五层验证口径为：纯领域 unit、文件/进程 adapter unit、冻结 schema/向量 contract、fake/stub integration、真实 Harness 与 runner e2e。M2 不要求所有 66 向量执行，但要求每个被提升为可执行的场景贯穿至少一个产品路径、一个确定 oracle 和一个可追踪 artifact。

## 4. 交付物清单、位置与状态口径

| 交付物 | 内容与建议位置 | 验收方式 | 完成状态口径 |
| --- | --- | --- | --- |
| D1 配置与身份真实化 | `crates/dshd-core` 的 config/identity 领域规则；`crates/dshd-adapters` 的 identity 文件 adapter；`crates/dshd` 装配 | ID-01/02 正反例、并发 create-if-absent、损坏文件与 mismatch 测试 | 仅当非法输入在 listener/spawn 前 fail-closed 且合法身份可重启复用时完成 |
| D2 原子状态与单写基础 | desired 文件 adapter、observed 内存模型、writer guard adapter、typed error | 原子替换故障注入、同卷双进程 CF-01 | 仅当竞争者输出 `WRITER_GUARD_HELD` 且无子进程副作用时完成 |
| D3 state coordinator | core 事件、归约器、snapshot、优先级与发布接口 | 状态表穷举 unit、ST-01/03/04/07/08/10/12/13/14 本地 oracle | 仅当所有共享状态都由单一串行归约路径变更时完成 |
| D4 supervisor 与生命周期 reconcile | process adapter、退避策略、process group、stop timeout、generation 分配 | fake crash/延迟/拒绝退出、ST-05/06/11/13/14 集成 | 仅当旧 generation 不复活、停止与关闭有界收敛时完成 |
| D5 Harness 认证引导 | ready URL parser、exact authority、内存 token/cookie、exchange 与 probe、不可变 context | PX-01/02 认证正反例、日志与持久目录 secret 扫描 | 仅当 probe 成功才发布 READY，任何 authority 漂移都撤销本代上下文时完成 |
| D6 冻结真实 Harness 接入 | 只读 `dsh/` 安装产物、固定启动 profile、真实 stdout/auth/probe/stop | 基线摘要核对，真实启动→READY→crash→N+1→停止链路 | 必须连接 commit `cd5ef8148158c3a752a658978873241fdf8e2bbc` 对应快照 |
| D7 fake Harness 与 reference stub 增量 | ready 分片/延迟/恶意 URL、cookie/probe 拒绝、崩溃/挂起 fixture；中央结论事件注入 | 各工具 `--version`、`--self-test` 与确定性 transcript | stub 只模拟输入，不声称已实现中央业务 |
| D8 runner 的 M2 driver 与报告 | `tools/conformance-runner` 接入 ID/CF/ST 本地子集，保留 66 manifest | 驱动实际 dshd；JSON/JUnit/人读输出一致；故意破坏 oracle 必须失败 | `declared=66` 不变，executed 只等于本次真实运行数，不预写固定虚数 |
| D9 capability-report 与出口证据 | 能力证据位、M2 exit-record、reports 索引、CI job | 缺 artifact/digest/环境时 fail；AC/VM 全量链接 | 证据位登记不等于能力通过，只有有效 artifact 才可 PASS |

D1～D9 是实现和证据的逻辑分组，不授权本规划任务现在修改上述代码位置。步骤 3 的实现 Agent 应在 M1 现有文件内增量填充，避免为同一职责另建平行框架。

## 5. 模块设计概要

### 5.1 Configuration 与 Identity

Configuration 在启动最前面构造不可变配置：node_id 和 secret 必填；`DSHD_ADVERTISE_URL` 与 `DSHD_CENTRAL_BASE_URL` 必须是允许的绝对 URL，拒绝 userinfo、path、query、fragment；listener 为非特权 `1024..65535`。任何错误在打开 listener、取得运行副作用或启动子进程前返回稳定错误。

Identity Store 读取 `/var/lib/dsh/dshd/identity.json`。空白卷只生成 UUIDv4 storage_id，将 schema version、注入 node_id 与 storage_id 写入同目录临时文件，设置权限，flush/fsync 后 atomic rename，并同步父目录；并发初始化只能有一个事实记录。已有文件的 node_id 与注入值不等时失败且绝不覆盖。secret、launch token、cookie 不进入 identity；M2 也不写入中央接入事实。

### 5.2 desired/observed 状态模型

desired state 是持久的操作者意图，仅有 `RUNNING|STOPPED`；observed state 是当前进程事实，采用 `STARTING → AUTHENTICATING → READY` 正向链，以及 `UNHEALTHY`、`STOPPING`、`STOPPED`、`FENCED` 控制态。二者正交：例如 desired=RUNNING 可以搭配 STARTING、AUTHENTICATING、READY、UNHEALTHY、STOPPING 或因外部明确隔离输入而最终 STOPPED；desired=STOPPED 不允许 reconcile 再次 spawn。

```text
默认/显式 RUNNING ──reconcile──> STARTING ──ready URL──> AUTHENTICATING
       ▲                              │                       │
       │                              └─exit/timeout──────────> UNHEALTHY
       │                                                      │
       └──────────────────退避到期、仍 RUNNING、未隔离─────────┘
AUTHENTICATING ──exchange+probe 成功──> READY
READY ──child exit/probe failure──> UNHEALTHY ──停止旧代──> STOPPED ──恢复──> STARTING
任意非 STOPPED ──desired=STOPPED/shutdown/明确 FENCED──> STOPPING ──有界终止──> STOPPED
```

`FENCED` 同时表示 registration 维度的明确隔离事实和最高优先级控制事件；observed 进程仍须经 STOPPING 收敛 STOPPED，desired 保留。M2 的 stub 只能注入该事件。中央不可达或时间输入不得被本地猜测成明确隔离；wall clock 跳变不改变本地单调时序。ST-10 涉及业务连接撤销的部分留待后续代理阶段，M2 只证明同一原子迁移先撤销 ready/context 并拒绝新的 context 取得。

State Coordinator 是唯一写者：所有 child、timer、auth、desired、signal、外部裁决输入先变成 typed event，经纯 reducer 得到新 snapshot 与 effects，再由 effect executor 执行文件或进程操作并把结果回送事件。snapshot 至少包含 daemon phase、registration phase、desired、observed、generation、context presence、last error 与 shutdown flag；发布对象不可变。不得让 supervisor、health 或测试 driver 直接篡改字段。

### 5.3 generation 语义

generation 标识一次可供调用方绑定的成功 Harness 实例，而不是 spawn 尝试次数或 dshd 重启次数。新子进程完成 ready 解析、cookie exchange 与 probe 后，coordinator 原子发布 N+1 generation 和对应不可变 `{authority, origin, cookie, generation}`；旧 context 在发布新代前已撤销。启动失败不发布新 generation，崩溃恢复成功才从上一个已发布值递增。重启恢复必须从持久/已定义事实推导连续语义，不允许旧子进程或延迟 auth 结果覆盖当前代。

每个异步 effect 携带 attempt id 或 generation fence。coordinator 丢弃不再匹配当前 attempt 的 stdout、exit、timer、probe completion。这样 stop、shutdown 或明确隔离事件与慢认证并发时，晚到结果不能重新置 READY。

### 5.4 writer guard 与 supervisor

writer guard 在身份和 desired 读取完成后、任何 Harness spawn 前取得。实现可采用服务设计给出的 `flock --nonblock --no-fork` 等价语义，但 guard 的所有权和子进程 PID 必须可测试、可观察。竞争失败产生 typed `WRITER_GUARD_HELD`，撤回 local/ready，不启动子进程；退出路径按所有权释放。部署层仍负责跨 task 排他挂载。

supervisor 只消费 coordinator 给出的 reconcile intent，负责 process group、stdout/stderr 管道、有界 ready 行、退出侦测、指数退避参数和 signal escalation。退避应确定、可注入时钟、设上限，并在 desired 改为 STOPPED、shutdown 或明确隔离时取消。SIGTERM 首先撤销 context、进入 STOPPING，再向 process group 发信号；冻结设计给出 8 秒后升级 SIGKILL、容器 grace 不少于 15 秒，测试用虚拟时钟或缩短的注入参数验证同一语义。

crash recovery 路径为：child exit → 同一原子迁移撤销 READY/context → 标记 UNHEALTHY → 清理旧进程与认证材料 → 若 desired 仍 RUNNING 且未隔离则等待退避 → 新 attempt → 认证探测成功 → 发布 N+1。任何 stop 先原子持久化 desired=STOPPED，再中断自动恢复，保证 ST-06 重启后不自动 spawn。

### 5.5 Harness Bootstrap/Auth

ready parser 只在规定大小和时限内读取 stdout，拒绝多义、畸形、非 HTTP、非 loopback、带意外组件的 URL。它从 `http://127.0.0.1:<dynamic>/?token=...` 提取 exact authority 与一次性 launch token，不把 token写日志。后续 token exchange、probe 及未来对该代的所有访问都复用相同 `127.0.0.1:port` Host；用 `localhost`、解析后的其他地址或端口即失败。

cookie jar 按 authority 和 generation 隔离，只驻内存。exchange 成功后立即从一般流程中消除 launch token；probe 必须携带该 cookie，并在预期状态、内容和时限满足后才回送 BootstrapSucceeded。失败时销毁 cookie、终止或回收本 attempt，禁止保留半认证上下文。日志只保留阶段、attempt、generation、错误类别和脱敏 authority。

## 6. M1 骨架复用与扩展点

| M1 资产 | M2 真实化方式 | 保持不变的契约 |
| --- | --- | --- |
| `dshd-core` 的 config/identity/state/lifecycle 边界 | 用纯类型、事件、reducer、端口替换 `NOT_IMPLEMENTED` 占位 | core 不依赖 OS；共享状态单写 |
| `dshd-adapters` 的 supervisor/harness/files | 填充锁、原子文件、process group、stdout、认证客户端 | adapters 依赖 core/contract，不反向定义领域 DTO |
| `dshd` main | 组装启动顺序、取消令牌、signal 与任务生命周期 | main 不承载业务规则 |
| `dshd-contract` 生成物与 drift gate | 只复用生成类型和校验入口；不手改生成物 | OpenAPI 唯一权威，无第二套 DTO |
| fake Harness | 把 M1 fixture 接口变为 M2 ready/auth/crash 确定性 server | 独立版本、自检不计向量执行 |
| reference stub | 增加明确隔离、中央不可达等输入 driver | 不实现或冒充 M6 完整客户端 |
| conformance runner 的 66 行 manifest | 保持 ID 与总数，接入实际 driver、oracle 和 evidence | `DECLARED|EXECUTABLE` 含义不漂移 |
| capability-report | 增加 DSHD 进程/认证证据位和 artifact 校验 | 空位或缺证据不算覆盖 |
| `.github/workflows/m1.yml` 与发布摘要脚本 | 在原锁定链上增加 M2 jobs/字段，保持 `--locked` | Rust 1.89.0、Cargo.lock 和 Harness 摘要不解冻 |

## 7. 依赖与工具链

M2 沿用 M1 已锁定的 Rust `1.89.0`、workspace `Cargo.lock`、clippy/rustfmt 策略和既有低层 tokio/hyper 方向；本计划不选择新网络框架、不改变生成链、不更新依赖。所有 Cargo 构建、检查、测试、工具运行使用 `--locked`。若现有依赖缺少原子文件、flock 或 process group 所需最小能力，步骤 3 只能在不解冻工具链与不复制 DTO 的前提下提出最小依赖变更，并以锁文件、许可证和 clean build 证据审查；不得因便利升级整个闭包。

真实 Harness 固定为 `dsh-v0.1.2-alpha.1`、commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`、tree `a712eec535b48badc4fefb4df5176a7002e4280b`、`pnpm-lock.yaml` SHA-256 `506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`、Node.js `24.x`、pnpm `11.7.0`，运行 profile 为 `dsh web --no-open --port 0`。安装只发生在 builder/CI 准备阶段并使用 frozen lock；运行阶段不得联网解析依赖。

## 8. 风险与对策

| 风险 | 预防与检测 | 失败时处理 |
| --- | --- | --- |
| 状态写者分散导致竞态 | reducer 单写、typed effects、并发模型测试、晚到事件 fence | 阻断集成，不以额外锁掩盖双状态机 |
| desired 写入与 spawn 次序倒置 | 先 durable commit 再发 effect，故障点逐一注入 | fail-closed；重启从最后 durable desired reconcile |
| guard 只锁 dshd 而未覆盖子进程 | 双进程/父进程退出/子进程存活矩阵实测 | 调整 fd/`--no-fork` 所有权并重跑 CF-01 |
| stdout 注入或 ready 行无界 | 限长、限时、只接收一次、严格 URL parser | 杀掉 attempt，记录脱敏分类，不进入认证态 |
| authority 规范化偷换 | 保存原始合法 exact authority，所有请求显式 Host | PX-02 负例失败即阻断 READY |
| token/cookie 泄漏 | secret wrapper 禁止 Debug/Display，日志和持久目录扫描 | 视为门禁失败，清理 artifact 并轮换测试材料 |
| crash/stop 并发复活旧代 | attempt fence、优先级、取消令牌、虚拟时钟测试 | 丢弃晚到成功，确保 STOPPING→STOPPED 后再判定 |
| fake 与真实上游行为差异 | fake 负责故障覆盖，真实快照负责兼容闭环 | 两类证据分栏；真实失败不得用 fake PASS 替代 |
| executed 统计虚高 | runner 运行时计数、逐项 evidence、故意破坏 oracle 负测 | 无 artifact 的条目退回 declared |
| 范围蔓延到后续里程碑 | 每任务列非目标，代码审查按模块与关键词核对 | 越界变更不合并，保留 typed port 即可 |

## 9. M2 出口门禁与七条验收标准映射

| AC | 冻结验收标准 | 方案实现与判定 | 主要证据 |
| --- | --- | --- | --- |
| AC-01 | 干净检出后构建、lint、typecheck、unit、contract 一次通过 | 在同一 commit、锁定依赖、无缓存环境运行完整 required jobs；任一重跑拼接不算通过 | 单次 CI run、工具版本、commit、退出码 |
| AC-02 | 同卷双 dshd 只有一个取得单写权 | 先取得者可 spawn；竞争者无 child、local/ready 均否并输出规定错误 | CF-01 transcript、PID/lock/health 观测 |
| AC-03 | 真实 Harness 可启动、认证、探测、守护并崩溃恢复 N+1 | 核对冻结摘要后运行完整 happy/crash 链；probe 前不得 READY | 真实进程 transcript、generation snapshot、基线摘要 |
| AC-04 | desired/observed 正交；stop 重启不自启；关闭有界 | durable STOPPED 后重启；SIGTERM 撤销上下文并在时限内 STOPPED；desired 保留 | ST-06、ST-14 报告与持久文件快照 |
| AC-05 | exact authority 与 secret 约束成立 | `127.0.0.1` 成功、`localhost`/其他 authority 失败；token/cookie 不落盘不入日志 | PX-01/02 认证报告、扫描报告 |
| AC-06 | 非法 identity/config 在副作用前失败 | 缺失/非法 URL、端口越界、node mismatch 均不 listener、不 spawn、不覆盖 | ID-02 负例矩阵与文件 hash |
| AC-07 | runner 真实执行本地子集且诚实报告 | 66 条声明完整；实际 driver 运行数决定 executed；后续依赖条目仍为 declared | JSON/JUnit/人读报告、逐项 artifact |

出口记录按 AC-01～AC-07 判定 `PASS|FAIL|BLOCKED`，再按六要素验收方法形成 VM-01～VM-06：VM-01 干净 CI；VM-02 双进程单写实测；VM-03 真实 Harness 启动、认证、探测、崩溃恢复；VM-04 runner 与计数核对；VM-05 非法输入、损坏文件、并发写反例；VM-06 对照路线图原文签核。缺失原始 artifact、环境、commit 或退出码的项目不得记 PASS。

## 10. 诚实边界与移交

M2 结束时，runner 仍必须报告 `declared=66`。M2 只增加 ID/CF/ST 中确由 dshd 本地实现、fake/stub 驱动或真实 Harness 支撑且 oracle 已执行的子集；ID-03/04、CF-02/03/04、ST-02/09 以及其他依赖中央完整行为、管理面或透明数据通道的部分保持 declared。即使某个向量的本地后果已有 unit test，只要整条 runner 场景尚未真实驱动，也不能标 executed。

M2 不证明中央注册续租、管理 API 与幂等、HTTP/WS 透明传输、跨节点迁移、目标 ECS 收敛或 66 向量全部通过；不修改 Harness 源码，不把本地 guard 描述为跨 task 排他。向 M3 移交的稳定面只有：不可变配置与 identity、durable desired、coordinator snapshot/event 端口、lifecycle 内部命令端口、supervisor 与认证 context、真实执行证据格式。M3 应在此基础上增加管理入口，而不是建立第二套状态机。

最终只有 AC-01～AC-07 与 VM-01～VM-06 全部有真实证据、所有越界项明确未实施时，才可签署 M2 门禁：“dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行”。
