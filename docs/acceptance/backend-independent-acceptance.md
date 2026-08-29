# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 验收依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | 独立验收 | 对分布式 DeepSeek Harness 后端设计包进行自洽性、真实性、逻辑、完整性、架构、边界、协议硬度和整体一致性验收。 | 冻结 MVP 基线、后端节点 HLD、中央服务—dshd 接口规范、Harness 固定源码基线 |
| v1.1 | 2026-08-29 | 独立复验 | 对 AC-01～AC-13 的根因修复执行反例推演、跨文档一致性复验、OpenAPI 语义校验和契约覆盖检查。 | 修订后的三份规范性文件、OpenAPI 3.1、conformance matrix |
| v1.2 | 2026-08-29 | 独立验收 | 不继承 v1.1 结论，重新执行有效状态、时钟、会话恢复、WebSocket、机器 schema 和验证器反例审计。 | 当前规范性文件、固定 Harness 源码、OpenAPI 3.1、验证器实际行为 |
| v1.3 | 2026-08-29 | 独立复验 | 对 AC-14～AC-20 的共同根因、统一解法和失败反例进行复验，并重新执行机器契约与跨文档一致性检查。 | 修订后的基线、HLD、接口规范、OpenAPI、conformance matrix 和验证器实际输出 |
| v1.4 | 2026-08-29 | 独立验收 | 不继承 v1.3 结论，重新审计首次部署、身份/generation 竞态、流式重试提交点、operation 状态联合、错误响应闭包和运维输出。 | 当前冻结基线、HLD、接口规范、固定 Harness 源码、OpenAPI 反例和验证器实际行为 |
| v1.5 | 2026-08-29 | 独立复验 | 对 AC-21～AC-28 先执行共同根因定位和方案反例验证，再复验修订后的全部规范、OpenAPI 联合、验证器和跨文档一致性。 | 修订后的基线/HLD/接口、OpenAPI 3.1、66 个行为向量、固定 Harness 源码和验证器实际输出 |
| v1.6 | 2026-08-29 | 独立验收 | 不继承 v1.5 结论，按不过度扩张的 MVP 设计边界重新检查真实性、自洽性、逻辑、完整性、架构/模块边界、协议硬度和整体一致性。 | 当前冻结设计包、固定 Harness 源码、独立故障反例、OpenAPI/validator 实际输出 |
| v1.7 | 2026-08-29 | Agent（设计基线维护） | 记录用户发现的职责措辞和固定 8080 问题；将端口修正为单一可配置 dshd service port。此项为一致性维护，不冒充新一轮独立验收。 | 用户澄清、修订后的基线/HLD/接口/OpenAPI |
| v1.8 | 2026-08-29 | Agent（问题修复记录） | 记录六要素审查后的根因、统一解法和反例验证：接口方向、endpoint 来源、非特权端口、后端验收边界和 ECS 环境基线。此项仍不冒充独立验收。 | 用户要求、修订后的基线/HLD/接口/OpenAPI/conformance |
| v1.9 | 2026-08-29 | Agent（问题修复记录） | 记录路线图复核后的共同根因和统一修复：能力基线、验收资产归属、阶段 DAG 与 M7 ECS 前置门禁。此项不冒充新的独立验收。 | 用户要求、[Web 能力冻结基线](../dsh/harness-web-capability-baseline.md)、修订后的路线图/HLD/接口/conformance/validator |

# DeepSeek Harness 分布式后端设计独立验收报告

## 1. 验收结论

**最近一次独立结论（v1.6）：通过独立设计验收。v1.7～v1.8 随后的职责、端口、endpoint、验收边界和环境基线修正已进入设计基线，但尚未执行新一轮独立验收；不得把这些一致性维护表述为新的独立通过结论。**

v1.4 的 5 项 P1 和 3 项 P2 已以共同根因级控制关闭：

- node_id/token 由部署控制面成对预登记，dshd 只在空白卷生成 storage_id，已有 identity mismatch fail closed；
- Session 对账绑定完整 usable_key+sync_epoch，反向 ready 与 inventory 提交均校验同一版本；
- 透明 Harness HTTP 在中央 relay 和 dshd 都是单次尝试，响应提交前后具有唯一失败语义；
- 所有受保护 OpenAPI operation 都声明 400/401/403，状态码与 error code 由专用 schema 约束；
- Operation 同时按 state 和 type 封闭，生命周期强制停止优先级及所有运行态转换已固定；
- 运维输出收敛为 status/heartbeat 指标与 container stdout/stderr，幂等指纹固定为 RFC 8785 JCS。

这些修复全部位于 Harness 外层，没有修改 Harness 存储、运行时或 Session 模型。扩充后的 validator 实际 PASS，并执行了状态/type 与错误映射正反例；66 个端到端行为向量仍为 `0 executed`，因此本结论只表示设计可实施，不表示 dshd、目标 ECS 或官方 Web UI parity 已运行验收。

## 2. 验收范围与基线

### 2.1 规范性设计文件

| 文件 | 角色 |
| --- | --- |
| [mvp-baseline.md](../mvp-baseline.md) | 已冻结的目标、范围和边界，最高需求基线 |
| [backend-node-hld.md](../backend-node-hld.md) | 后端节点、Docker、模块、运行时和中央服务边界的高层设计 |
| [central-dshd-interface-spec.md](../interfaces/central-dshd-interface-spec.md) | 中央服务与 dshd 的控制、管理和透明代理契约 |

### 2.2 事实基线

| 项目 | 固定值 |
| --- | --- |
| Harness commit | `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| Harness tag | `dsh-v0.1.2-alpha.1` |
| 本地源码目录 | `dsh/` |
| 能力审计 | [harness-api-exposure-audit.md](../dsh/harness-api-exposure-audit.md) |

### 2.3 范围说明

本报告验收的是后端架构与接口设计，不把尚未完成的 dshd、中央服务或 Docker 镜像实现误判为设计缺陷，也不声称已经完成实现验收、性能验收或生产安全验收。

## 3. 总体评分

| 维度 | 结论 | 说明 |
| --- | --- | --- |
| 可行性 | 通过 | 原生 Harness 已暴露官方 Web UI 所需后端 surface，外围代理路线成立 |
| 架构合理性 | 通过 | 控制面、节点入口、业务引擎和存储所有权分层合理 |
| 模块定义与边界 | 通过 | 中央服务、dshd、Harness 和部署存储的主要所有权及责任已分离 |
| 源码真实性 | 通过（设计阶段） | Harness 依赖均有固定源码证据；目标容器运行能力保留为实现门槛 VG-01/VG-02 |
| 自洽性 | 通过 | 基线、HLD、接口、OpenAPI 与 conformance 对首次置备、usable key、提交边界和状态优先级表述一致 |
| 逻辑正确性 | 通过（设计阶段） | generation ABA、迟到结果、流式半响应和 Operation 矛盾反例均得到唯一安全结果 |
| 完整性 | 通过（设计阶段） | 身份置备、生命周期、代理、Session 收敛、日志/指标和 Docker 边界均有 owner 与输出 |
| 协议硬度 | 通过 | 8 个受保护 operation 的错误闭包、42 个 schema、Operation/error 正反例和 66 个时序向量可校验 |
| 整体一致性 | 通过 | AC-21～AC-28 已关闭，无仍开放的设计 P0/P1/P2；VG-01～VG-03 保持实现门槛 |

## 4. 已通过项

### 4.1 冻结目标与总体路线一致

设计没有要求替换 Harness 存储、Agent runtime 或 Session 模型。dshd 只做生命周期、认证接管、透明代理和节点事实上报，符合冻结基线。

### 4.2 节点部署边界合理

一个镜像固定携带 dshd 与 Harness 版本；容器只发布一个可配置 dshd service port，默认 `8080`；Harness 使用 `127.0.0.1:<dynamic>` 且不发布；`DSH_HOME`、`HOME`、Workspace、tmpfs 和非 root UID/GID 的划分清楚。dshd 不访问 Docker socket、不发现容器外 Harness，职责范围明确。

### 4.3 Harness 通信路线真实可用

以下关键事实均与源码一致：

- Web server 接受端口 `0` 并取得 OS 分配端口：`dsh/packages/host/webserver/src/index.ts:58-63,149-151`。
- ready URL 在 Loader 完成后输出，可作为 supervisor readiness signal：`dsh/packages/bundle/web-app/src/index.ts:262-296`。
- launch token 可通过根页面换取 cookie：`dsh/packages/client/connection/src/browser-auth.ts:240-264`。
- `/api` HTTP 与 `/api/remote.mux` WebSocket 都执行 Host/Origin trust fence 和 cookie 认证：`dsh/packages/client/connection/src/rpc-host.ts:95-99`、`dsh/packages/api/gateway/src/index.ts:215-223`。
- Session create 支持调用方指定 `sessionId`：`dsh/packages/api/session-controller/src/types.ts:269-275`、`commands.ts:72-110`。

### 4.4 透明代理边界选择正确

完整代理所有方法的 `/api/**`，并把 `/api/remote.mux` 作为逐节点一对一 WebSocket 隧道处理，能够覆盖 Remote、stream、event、waterfall 和 Session ZIP；dshd 不解释 Typert payload 的选择正确。

### 4.5 数据所有权主线清楚

Harness 是 Session、消息、附件、设置、凭据和 Workspace 业务事实的权威；中央服务只持有路由元数据；dshd 不复制或修改 Harness 业务状态。这一边界在三份核心文件中总体一致。

## 5. v1.0 阻断设计冻结的问题（历史审计记录）

本节保留首次验收时的原始发现和证据，用于审计追踪；其当前解决状态与规范证据见第 10 节，不再代表当前结论。

### AC-01：instance fencing 没有真正 fencing Harness 写入者

**证据**

- HLD 要求“一份 DSH_HOME 只由一个 Harness 进程使用”：`backend-node-hld.md:119`。
- 接口规范允许新 instance 通过 predecessor CAS 取得租约：`central-dshd-interface-spec.md:156-163`。
- 旧 instance 收到 `STALE_INSTANCE` 后进入 `FENCED`，但继续本地守护 Harness：`central-dshd-interface-spec.md:218-219,396-400`。

**问题**

中央租约只 fencing 了调度和网络入口，没有 fencing 旧 Harness 对 DSH_HOME/Workspace 的写入。如果滚动部署期间新旧容器能够同时挂载同一持久卷，新 instance 可以启动新的 Harness，而旧 instance 的 Harness 仍然运行，直接违反单写约束。`node_id + instance_id + lease_id` 不是存储锁。

**复验条件**

必须同时固定：

1. dshd 收到明确 `STALE_INSTANCE` 后，停止接受业务并在有界时间内停止本地 Harness；
2. 部署或 dshd 层提供 DSH_HOME 单写保证，例如独占卷挂载、租约关联文件锁或等价机制；
3. successor 只有在 predecessor 已释放写权，或已通过可证明的强制隔离后，才能启动 Harness。

### AC-02：冷启动是否依赖中央注册存在矛盾

**证据**

- HLD 规定 listener 就绪后立即注册，注册“不等待 Harness READY”：`backend-node-hld.md:160`。
- HLD 节点接入时序却是“注册成功并取得租约后才启动 Harness”：`backend-node-hld.md:362-365`。
- 冻结基线和接口故障语义要求中央服务不可达时 Harness 继续运行：`mvp-baseline.md:53`、`central-dshd-interface-spec.md:518`。

**问题**

不同实现团队可以得出两种互斥实现：中央不可达时仍启动 Harness，或等待注册成功后才启动。后一种会让中央故障阻断节点冷启动，与控制面失联不影响本地 Harness 的目标不一致。

**复验条件**

固定唯一顺序：dshd listener、Harness 启动和中央注册之间哪些并行、哪些有依赖；明确“中央服务从容器启动前即不可达”时 Harness 是否必须启动。建议 Harness 本地启动与注册退避相互独立，心跳报告当时的实际状态。

### AC-03：Session 创建与派生 Session 的路由闭环不完整

**证据**

- 冻结基线的创建流程是 Harness 创建成功后才保存映射：`mvp-baseline.md:70-77`。
- 接口规范改为调用前保存 `CREATING` 映射：`central-dshd-interface-spec.md:477-494`。后者逻辑更可靠，但与最高需求基线直接冲突。
- `SessionForkRequest` 没有目标 Session ID：`dsh/packages/api/session-controller/src/types.ts:305-313`。
- Harness fork 在内部生成 `session-${randomUUID()}`：`dsh/packages/api/session-controller/src/commands.ts:187-275`。
- 当前接口规范只定义普通 create 的映射流程，没有 fork 成功、响应丢失或派生 Session 的路由收敛流程。

**问题**

官方 Web UI 的 fork 属于冻结能力范围。成功响应时中央服务可以记录返回的 child ID，但响应丢失时不能用显式 ID重试；盲目重试会再创建一个 child。若不定义收敛规则，随后以 child Session ID 发起的请求可能无法路由。

**复验条件**

1. 将冻结基线与接口规范统一为同一个 create 映射顺序；
2. 为 fork 固定“成功后登记、禁止自动重试、未知结果状态、同节点对账/人工恢复”的明确语义；
3. 明确 subagent child 是依赖 parent 路由，还是也进入全局 Session 路由表；
4. 把 create、fork、subagent 和映射缺失场景加入契约测试。

上述闭环可以位于中央服务和接口契约中，不要求修改 Harness。

### AC-04：Harness cookie 的 canonical authority 不变量没有写成硬契约

**证据**

- Harness cookie payload 绑定请求 authority，cookie 名也由 authority 哈希生成：`dsh/packages/client/connection/src/browser-auth.ts:27-30,69-107,285-300`。
- Origin 存在时必须与 Host 的 authority 精确同源；Origin 缺失可以接受：`dsh/packages/client/connection/src/api-request-trust.ts:91-117`。
- 现有设计只写“注入本地 Host、Origin 和 cookie”：`central-dshd-interface-spec.md:364-365`。

**问题**

`127.0.0.1:PORT`、`localhost:PORT` 和不同端口不是同一 cookie authority。若 bootstrap 用 ready URL 的 authority，而后续 HTTP/WS 使用另一个本地写法，即使 cookie 值正确也会得到 401。现有文字不足以阻止这种实现。

**复验条件**

接口规范必须定义一个随 generation 原子发布的 canonical Harness authority，并要求 token exchange、API probe、所有 HTTP 和 WS 请求使用完全相同的 Host；Origin 要么省略，要么严格等于 `http://<canonical-authority>`。该不变量需要负向测试覆盖。

### AC-05：HTTP 响应头透明规则在协议上不安全且不完整

**证据**

- 规范要求原样转发 response headers：`central-dshd-interface-spec.md:361-363`。
- 同一节只规定剥离请求侧 hop-by-hop headers，没有规定响应侧处理：`central-dshd-interface-spec.md:364-368`。
- Harness bootstrap 会产生只应留在本机的 `Set-Cookie`：`dsh/packages/client/connection/src/browser-auth.ts:256-263`。

**问题**

HTTP 代理不能跨连接转发响应侧 hop-by-hop headers；Harness 本地 cookie 也不得泄漏给中央服务或前端。当前“原样响应头”与安全边界之间没有例外规则，未来 Harness 新增 cookie 或本地 Location 时也会泄漏内部 authority。

**复验条件**

明确请求和响应两侧的 hop-by-hop 过滤算法；响应必须剥离本地 `Set-Cookie`，并规定 `Location`、`Trailer`、`Transfer-Encoding`、`Connection` 及其点名 header 的处理。透明性应定义为端到端语义透明，而不是逐字节复制连接级 header。

### AC-06：中央服务—dshd 控制协议尚未达到“硬契约”标准

**证据**

当前只有 Markdown 示例和自然语言规则，仓库中没有对应的 OpenAPI/JSON Schema、枚举 schema、示例校验或兼容性测试夹具。若干字段也没有唯一约束，例如：

- request/response 字段哪些必填、哪些可选；
- `last_error` 和 operation `result/error` 的完整结构；
- capability 必需集合及未知 capability 行为；
- `cpu_percent` 的取值范围、采样窗口和多核语义；
- body/header 上限、并发保护值和 `429` 触发条件；
- 同一 `Idempotency-Key` 携带不同请求体时的结果；
- enum 扩展时旧接收方的行为。

**问题**

两个团队仅凭当前文件可以实现出彼此不兼容但都自认为符合文档的服务。版本规则声明“同 major 可增加字段”，但没有 schema 和合约测试验证它。

**复验条件**

至少为 Node Registry API 和 Daemon Management API 提供可执行的 OpenAPI 3.1/JSON Schema，并生成正反例合约测试；透明 `/api/**` 和 `remote.mux` 不需要重新建模 Harness payload，但必须有代理行为测试向量。

### AC-07：默认会话遥测与后端隐私边界未决

**证据**

- 官方 base Web profile 默认使用 `FEEDBACK_ONLY`：`dsh/packages/bundle/base/cordis.patch.yml:168-196`。
- 用户执行 `/feedback` 时可上传尚未共享的会话记录；随附配置没有脱敏规则，可能包含消息、工具参数/结果和 Workspace 路径：`dsh/apps/cli/reference/README.zh.md:90-94`。
- HLD 安全、隐私和出站网络设计没有声明 `DSH_TELEMETRY_MODE` 或遥测目的地策略。

**问题**

这是一个真实的容器出站数据流，不经过中央服务或 dshd。若按默认配置发布，系统会在特定用户动作后把 Session 内容发送到外部 collector，与“数据权威和网络边界”描述不完整。

**复验条件**

MVP 必须明确选择：默认设置 `DSH_TELEMETRY_MODE=DISABLED`，或将遥测目的地、授权、告知、脱敏和出站网络列为正式设计。该决定需要进入镜像配置、威胁模型和验收用例。

## 6. v1.0 非阻断问题（历史审计记录）

### AC-08：ID 通用规则错误覆盖了 Harness Session ID

接口规范写“ID 均为 UUID v4，node_id 除外”：`central-dshd-interface-spec.md:52`。Harness Session ID 实际是 opaque branded string；默认形态为 `session-<uuid>`，测试和调用方也不应依赖其格式。应把 `session_id` 明确排除在控制协议 UUID 规则之外，并定义为原样、不解析、大小写敏感的 Harness SessionId。

### AC-09：HLD 文档状态与自身修订记录冲突

HLD v0.4 已声明固化接口字段与 Bearer 安全机制：`backend-node-hld.md:8`，但文档状态仍写“具体接口字段与安全机制待 LLD 固化”：`backend-node-hld.md:18`。这会造成规范是否已冻结的治理歧义。

### AC-10：规范性文件层级和术语没有声明

能力审计仍使用旧名 Node Agent，并写到其可补充“本机 Session list 摘要”：`harness-api-exposure-audit.md:5,86-101`；最终 HLD 则要求 dshd 不复制 Session 索引。研究材料可以保留历史结论，但必须标记为 informative，并声明发生冲突时的优先级：冻结基线 → 已批准 ADR/HLD → 接口规范 → 研究审计。

### AC-11：dshd、registration 和健康状态的正交关系不够明确

接口规范把 `FENCED` 放进 dshd 状态，但状态响应又单列 registration state；公开 readiness 只表示 Harness generation 可用，不表达租约或 fencing。应固定每个字段的状态空间和派生关系，明确 FENCED 时 `/health/ready`、Docker HEALTHCHECK、status 和中央调度状态分别如何表现。

### AC-12：Bearer token 生命周期未闭环

每节点随机 token 和私网安全组适合作为 MVP，但规范没有定义 token 轮换、双 token 过渡、撤销、泄漏处置和失败审计。它不阻止 MVP 原型，但在称为完整后端设计前应至少给出人工轮换流程和失败行为。

### AC-13：若干运维参数仍是未决定值

自动重启次数、退避、启动/停止 timeout、性能容量目标仍在 HLD 中标记打开：`backend-node-hld.md:486-490`。可以不在 HLD 中臆造数值，但实现前需要配置 schema、默认值和边界；否则生命周期 operation 和健康收敛无法形成一致测试。

## 7. 必须保留的验证门槛

以下项目不是源码逻辑反证，但在完成前不能宣称“后端能力已经验收通过”：

### VG-01：目标 ECS/Docker sandbox 兼容性

官方 base profile 的 Linux sandbox 会在 bwrap 和 Landlock 间选择，无可用 runner 时 fail closed：`dsh/packages/sandbox/sandbox-local/README.md:12,55-77`。HLD 同时要求非 root、只读 rootfs、drop all capabilities 和 no-new-privileges。该组合是否能在目标 ECS 内核与容器运行时中保持官方工具能力，必须通过真实镜像测试证明，不能只由源码推断。

### VG-02：官方 Web UI parity E2E

能力 inventory 证明 API surface 存在，但不能证明代理实现无损。最终必须使用固定 Harness 版本，让官方 Web client 或等价协议测试穿过“中央服务 → dshd → Harness”，覆盖：Session create/fork/prompt/cancel、history/control/follow、审批、用户问题、settings、credentials、Workspace browse、附件、export GET/HEAD、断线、重启和 backpressure。

### VG-03：故障和竞态测试

必须覆盖旧 instance 延迟心跳、两个容器共享 node_id/volume、中央服务在冷启动前不可达、响应丢失后的 create/fork、Harness 在 AUTHENTICATING/UNHEALTHY 时并发生命周期命令，以及重启期间旧 HTTP/WS 的关闭语义。

## 8. v1.0 复验准入清单（历史）

下列条件全部满足后，设计包可以重新申请最终验收：

1. AC-01 至 AC-07 均有唯一、可测试的规范结论，且三份核心文件同步一致；
2. 控制协议提供机器可校验 schema 和合约测试，透明代理提供行为测试向量；
3. 明确文档优先级，并清除规范性文件中的旧术语和过期状态；
4. VG-01 至 VG-03 有可复现测试环境、用例和结果；
5. 不通过修改 Harness 存储、运行时或 Session 模型来规避问题；
6. 重新执行需求 → HLD → 接口 → 源码 → 测试的双向追踪检查。

## 9. v1.0 判断（历史）

后端基本架构已经清晰，核心模块与大部分边界也合理，继续沿用 `dshd + 原生 DeepSeek Harness` 是正确路线。当前不足集中在跨文档契约和异常路径闭环，而不是组件拆分错误。

因此，准确状态应是：

> **总体架构方案已成立；后端设计包尚未完成最终冻结，不应按“全部后端设计工作已完成”进入无条件实现。完成 7 项 P1 收敛并通过 3 类验证门槛后，可复验为通过。**

## 10. v1.1 修复复验（历史）

| 问题 | 根因级修复 | 规范证据 | 复验状态 |
| --- | --- | --- | --- |
| AC-01 | 把网络 lease 与存储写权拆开；single-attach volume 为跨 task 权威保证，storage_id 与 writer guard 做身份和本地互斥，FENCED 停 Harness | [backend-node-hld.md](../backend-node-hld.md)、[central-dshd-interface-spec.md](../interfaces/central-dshd-interface-spec.md)、CF-01～CF-04 | 通过 |
| AC-02 | Harness 冷启动与中央注册并行；控制面失联不触发本地重启 | 同上，ST-01～ST-04 | 通过 |
| AC-03 | create 预登记；fork 使用 intent + 禁止盲重试 + 同节点对账；subagent 继承 parent 路由 | [mvp-baseline.md](../mvp-baseline.md)、[central-dshd-interface-spec.md](../interfaces/central-dshd-interface-spec.md)、SR-01～SR-07 | 通过 |
| AC-04 | generation 级 canonical connection context；token exchange、HTTP、WS 使用同一 authority/cookie | [central-dshd-interface-spec.md](../interfaces/central-dshd-interface-spec.md)、PX-01～PX-04 | 通过 |
| AC-05 | 请求/响应分别过滤 hop-by-hop；剥离 Set-Cookie；重写或拒绝本地绝对 Location | 同上，PX-05～PX-07 | 通过 |
| AC-06 | 增加 [OpenAPI 3.1](../contracts/central-dshd-openapi.yaml)、[conformance matrix](../contracts/central-dshd-conformance.md) 与 [contract validator](../contracts/validate_contracts.py) | OpenAPI 语义校验通过；本地 `$ref`、JSON 示例、追踪标记和测试向量可重复校验 | 通过 |
| AC-07 | 镜像默认 `DSH_TELEMETRY_MODE=DISABLED` 与 `DSH_TELEMETRY_DISABLED=1` | [backend-node-hld.md](../backend-node-hld.md)、PV-02～PV-03 | 通过 |
| AC-08～AC-13 | 修正 SessionId 语义、文档优先级、正交状态、token 轮换、生命周期默认值和历史术语治理 | 三份规范性文件、ST-01～ST-05、CT-01～CT-05、PV-01 | 通过 |

反例复验覆盖了四条最容易产生“文字上修好、运行时仍失败”的路径：中央服务从冷启动前即不可达、旧 task 与 successor 重叠、租约在活动连接期间过期、fork 已成功但响应丢失。四条路径均能在现有契约下得到唯一且不破坏数据安全的结果。

**v1.1 最终判断：后端设计包通过独立复验并完成冻结，可以进入 dshd 与镜像实现。VG-01～VG-03 是实现完成后的验收门槛，不再作为设计冻结的阻断项。**

## 11. v1.2 独立验收发现（历史审计记录）

### 11.1 问题分级

| 级别 | 定义 | 数量 |
| --- | --- | --- |
| P0 | 证明总体技术路线不可行或必须修改 Harness 核心模型 | 0 |
| P1 | 会产生错误运行行为或互不兼容实现，阻断设计冻结 | 5 |
| P2 | 不推翻主流程，但协议证据或跨文档表述不够严格 | 2 |

### AC-14（P1）：Docker 健康检查使合法 STOPPED/FENCED 状态不可稳定存在

**证据**

- `/health/local` 只有 Harness generation 可用时返回 200，并被指定为 Docker HEALTHCHECK：`backend-node-hld.md:426,491`、`central-dshd-interface-spec.md:305`；
- 生命周期模型允许 Harness 进入并保持 `STOPPED`：`backend-node-hld.md:356,362-371`；
- `FENCED` 必须停止 Harness，且 local/ready 返回 503：`backend-node-hld.md:474`、`central-dshd-interface-spec.md:455`、`central-dshd-conformance.md:42`；
- Harness 启动失败时 dshd 应保持可管理：`central-dshd-interface-spec.md:595`。

**反例**

中央服务合法执行 `harness/stop` 后，Harness 进入 STOPPED，`/health/local` 随即返回 503。会依据容器健康替换 task 的运行环境将重建容器，而新 dshd 的冷启动规则又会自动启动 Harness。`stop` 因而无法保持；FENCED 和“失败但可管理”也会被同一机制破坏。

**复验条件**

Docker/ECS 的容器存活检查必须只判断 dshd 是否可管理，例如使用 `/health/live`；`/health/local` 保留为本地 Harness 诊断，`/health/ready` 保留为中央业务 readiness。必须增加 STOPPED、FENCED、UNHEALTHY 长时间保持且容器不被错误替换的测试，并明确自动恢复与管理 stop 的 desired-state 边界。

### AC-15（P1）：lease 本地失效没有单调时钟算法

**证据**

注册和心跳响应同时提供 `lease_expires_at`、`lease_ttl_ms`、`server_time`：`central-dshd-interface-spec.md:165-169,229-230`，但状态、重试和故障章节没有规定 dshd 如何把这些字段转换为本地失效 deadline。

**问题**

实现可以合法选择本机 wall clock、中央时间偏移或从响应时刻计 TTL。机器时钟回拨、漂移或请求延迟会让不同实现进入 DEGRADED 的时间不同；最坏情况下 dshd 在中央租约已失效后仍维持现有业务连接。这直接影响网络所有权 fencing。

**复验条件**

规定 dshd 在每次成功响应到达时，以本地 monotonic clock 建立不可延长的 lease deadline；剩余时间由 `lease_expires_at - server_time` 计算并受已协商 TTL 上限约束，同时定义安全余量、RTT 处理和 deadline 到达时原子关闭 readiness/HTTP/WS 的行为。增加 wall-clock 前跳、回拨、长 RTT 和丢失最后一次 heartbeat response 的测试。

### AC-16（P1）：Session 对账触发点与并行启动顺序不兼容

**证据**

- dshd 注册与 Harness 启动并行，注册成功时 Harness 可以仍为 STARTING：`central-dshd-interface-spec.md:185`；
- 只有 registration LEASED 且 Harness READY 时才允许业务代理：`central-dshd-interface-spec.md:416`；
- 对账却被要求在“节点注册成功”时执行，没有规定因 `HARNESS_NOT_READY` 失败后必须在首次 READY 重试：`central-dshd-interface-spec.md:569`。

**反例**

注册先成功，中央服务立即调用 `session.list`，dshd 按契约返回 `HARNESS_NOT_READY`；随后 Harness READY，但没有新的强制对账触发。已有 Session 的路由可能一直缺失，直到人工操作或一次不相关的 fork 故障。

**复验条件**

把强制触发点定义为每个 instance/generation 首次进入 `registration=LEASED AND Harness=READY` 的边沿；失败必须按同一节点重试直到成功或节点离线，并保证同一 generation single-flight。增加“注册先完成”和“Harness 先完成”两种顺序的对账测试。

### AC-17（P1）：WebSocket ping/pong 所有权存在矛盾

**证据**

- 代理要求 binary/text、fragment、顺序、ping/pong 和 close 原样传播：`central-dshd-interface-spec.md:432`；
- 重试表又要求 WebSocket 每 20 秒主动 ping、10 秒无 pong 关闭：`central-dshd-interface-spec.md:531`；
- PX-09 进一步要求 ping/pong 逐字节、逐帧保持：`central-dshd-conformance.md:57`。

**问题**

若 dshd 主动产生 ping，外部连接会出现 Harness 未产生的控制帧，不再是逐帧原样；若使用 raw frame tunnel，则 dshd 不应独立拥有同一条链路的 ping deadline。两种实现都能引用当前规范，契约不唯一。

**复验条件**

二选一固化：要么采用 raw tunnel 并取消 dshd 注入的 ping；要么明确 WebSocket 在 dshd 终止，ping/pong 属于逐 leg 的 hop-by-hop 健康机制，仅保证 Remote 业务 message 的类型、payload、顺序、取消和业务 close 语义。同步修改 HLD、接口规范和 PX-09。

### AC-18（P1）：OpenAPI 未固化关键状态条件

**证据**

`HarnessStatus` 的 READY 状态不要求 `pid/started_at`，`RegistrationStatus` 只要求 `state`：`central-dshd-openapi.yaml:651-674`。实际 schema 验证已证明以下响应合法：Harness 为 READY 但没有 PID/started_at，registration 为 LEASED 但没有 lease 时间；这与状态查询目标和租约判断所需事实不一致。

**复验条件**

使用 OpenAPI 3.1 `if/then` 或判别联合固定至少以下条件：Harness READY 时 PID、started_at 必填；registration LEASED 时 lease_expires_at、last_heartbeat_at 必填；非适用状态不得携带误导性字段。为每个状态提供正反例 schema 测试。

### AC-19（P2）：契约验证器的通过范围被高估

验证器对接口文档的 JSON block 只执行 `json.loads`：`contracts/validate_contracts.py:121-131`；对 conformance matrix 只检查 ID 不重复且六个分组存在：`contracts/validate_contracts.py:164-173`。因此当前 `Contract validation: PASS` 能证明 OpenAPI 结构、引用、JSON 语法、链接和测试编号有效，不能证明 Markdown 示例符合 OpenAPI schema，也不能证明 33 个行为向量已执行。

复验时必须把示例移动或映射到具体 component schema，执行正反例校验；行为向量在 dshd/中央实现出现前应明确标记为“测试规范未执行”，不得以 ID 数量替代通过结果。

### AC-20（P2）：单写验收仍保留错误的替代关系

接口规范正文和 CF-04 明确：跨 task 单写必须由部署层 single-attach 保证，writer guard 不得替代：`central-dshd-interface-spec.md:87`、`central-dshd-conformance.md:31`。但接口验收用例 12 仍写成“部署检查或 writer guard 阻止”：`central-dshd-interface-spec.md:623`。安全不变量不应使用 `or`；该用例必须改为部署层强制拒绝跨 task 同时挂载，writer guard 只验证同一挂载内重复进程。

### 11.2 真实性复核

本次重新核对本地固定源码，结果如下：

- 目录重整前核验的来源 HEAD 为 `cd5ef8148158c3a752a658978873241fdf8e2bbc`，tag 为 `dsh-v0.1.2-alpha.1`；当前 `dsh/` 为不含嵌套 Git 的冻结快照；
- `--port 0` 明确允许 OS 分配端口，WebServer 暴露实际端口；
- `dsh web:` URL 在 Loader settle 后输出，并包含 launch token；
- cookie 名和值绑定 exact authority，Host/Origin 约束真实存在；
- ordinary create 支持显式 SessionId 并调用 `ensureSession` 做 adopt；fork 在 Harness 内生成新的 `session-<uuid>`；
- `session.list`、Remote mux、GET/HEAD Session export 和 telemetry hard opt-out 均有源码证据。

因此，Harness 能力与通信事实本身通过真实性验收；本次不通过来自外围分布式设计的状态与契约，而不是源码假设被推翻。

### 11.3 机器检查结果及其边界

v1.2 当时的验证器执行结果为 PASS：10 个 OpenAPI path、33 个 schema、138 个本地 `$ref`、9 个可解析 JSON block、35 个本地链接和 33 个 conformance ID。该历史结果只按 AC-19 所述范围解释，不等于行为测试或目标环境验收通过。

### 11.4 v1.2 最终判断

| 验收问题 | 结论 |
| --- | --- |
| 总体架构是否合理 | 是；`中央服务 → dshd → 原生 Harness` 无需推翻 |
| 模块目标、职责与边界是否清晰 | 是；主要所有权和控制方向明确 |
| 设计是否自洽、逻辑正确 | 否；health/STOPPED/FENCED、lease deadline 和 READY 对账存在运行时缺口 |
| 协议和契约是否足够硬 | 否；WebSocket 控制帧语义和状态条件 schema 尚不唯一 |
| 设计整体一致性是否达标 | 否；存在 5 项 P1，不能维持 v1.1 的冻结通过结论 |

准确状态为：

> **技术路线可行、架构分层合理、源码事实可信；当前后端设计包有条件不通过。修复 AC-14～AC-18，并同步收敛 AC-19～AC-20 后，方可重新冻结。VG-01～VG-03 继续作为实现完成后的验收门槛。**

## 12. v1.3 根因修复独立复验（历史审计记录）

### 12.1 根因定位

| 根因 | 导致的问题 | 根本错误 | 修复原则 |
| --- | --- | --- | --- |
| RC-01 状态所有权混用 | AC-14 | container liveness、operator intent、Harness process fact 和业务 readiness 被压成同一“健康”概念 | 分离持久 desired、observed state、registration 与派生 readiness；每个健康端点只有一个消费者语义 |
| RC-02 时间/事件/连接所有权缺失 | AC-15～AC-17 | 契约描述了字段和正常流程，却没有指定谁决定 lease 失效、何时强制对账、谁产生 WS 控制帧 | 为每个时序不变量指定唯一 owner、触发谓词、算法、原子失效动作和允许例外 |
| RC-03 schema 只约束表面结构 | AC-18～AC-19 | Markdown 语义、OpenAPI 字段和验证器彼此独立，条件字段可缺失且示例只做语法解析 | 用 Draft 2020-12 条件 schema 固化依赖关系；示例逐一映射 component；为依赖关系加入负例 |
| RC-04 安全不变量缺少单一权威表述 | AC-20 | 同一文档一处要求 single-attach，另一处又允许 writer guard 替代 | 固定跨 task single-attach 是权威保证，writer guard 仅是同一挂载内的纵深防御；验收条件必须同时满足 |

这四项是问题的充分根因：删除任一控制都会重新构造出对应 AC 的失败路径；不需要修改 Harness 内部模型即可消除这些路径。

### 12.2 统一解决方案及跨文档落点

| 控制 | 硬约束 | 规范落点 |
| --- | --- | --- |
| desired/observed 分离 | `/var/lib/dsh/dshd/desired-state.json` 原子保存 `RUNNING | STOPPED`；显式 stop 先写 STOPPED；FENCED 停 observed process 但不覆盖 operator intent；Docker/ECS 只检查 `/health/live` | [MVP 基线](../mvp-baseline.md)、[节点 HLD](../backend-node-hld.md)、[接口规范](../interfaces/central-dshd-interface-spec.md)、ST-01～ST-07 |
| monotonic lease | 服务端同一权威时钟原子生成 server/expires 时间对；dshd 用 send/receive monotonic 时间、服务端剩余时间、完整 RTT 和 `max(1000ms, TTL×10%)` 余量计算本地 deadline；wall clock 不参与有效性；deadline 原子撤回业务 | [节点 HLD](../backend-node-hld.md)、[接口规范](../interfaces/central-dshd-interface-spec.md)、ST-08～ST-10 |
| usable-edge inventory | `lease valid + reverse ready + daemon READY + LEASED + desired RUNNING + observed READY + compatible` 每次 false→true 时建立新 sync epoch，并按 instance/generation single-flight；任一条件失效即作废旧标记；当前 epoch 对账成功才 ONLINE 和接收新 Session | [MVP 基线](../mvp-baseline.md)、[接口规范](../interfaces/central-dshd-interface-spec.md)、SR-08～SR-09 |
| raw WebSocket tunnel | 对齐 key/version/subprotocol/extensions 后才接受双方 101；随后逐 frame relay；中央与 dshd 的节点 leg 均不产生稳态 ping/pong，仅 generation 1012、lease 1013、FENCED 1008 为策略 close | [节点 HLD](../backend-node-hld.md)、[接口规范](../interfaces/central-dshd-interface-spec.md)、PX-09～PX-10 |
| 条件机器契约 | desired 始终必填；READY 必须有 pid/started_at，STOPPED 禁止；LEASED 必须有 lease 时间，UNREGISTERED/REGISTERING 禁止 | [OpenAPI](../contracts/central-dshd-openapi.yaml)、CT-06～CT-08、[验证器](../contracts/validate_contracts.py) |
| 单写权威 | 跨 task 必须由部署层 single-attach 拒绝；writer guard 不能替代，只阻止同一挂载内第二进程 | [接口规范](../interfaces/central-dshd-interface-spec.md)、CF-01～CF-04 |

### 12.3 失败反例复验

| 反例 | 修复后唯一结果 | 结论 |
| --- | --- | --- |
| operator stop 后容器重启 | desired 已持久化为 STOPPED，dshd live 但不 spawn Harness；仅显式 start/restart 恢复 RUNNING | 通过，AC-14 关闭 |
| 旧节点 FENCED 但 dshd 仍需诊断 | observed Harness 停止，live=200、local/ready=503；外部部署控制器停止旧 task 释放独占卷，dshd 不获得 Docker 权限 | 通过，AC-14/AC-20 同时闭环 |
| wall clock 回拨、长 RTT、乱序或迟到响应 | monotonic deadline 不回退，预算扣除 RTT/余量；旧 sequence 不续期；deadline 后必须重新注册 | 通过，AC-15 关闭 |
| 注册先完成、Harness 先 READY，或同 generation 失租后恢复 | 每次完整 usable predicate false→true 都创建新 sync epoch；失败持续退避，任一条件失效作废旧标记，当前 epoch 成功后才 ONLINE | 通过，AC-16 关闭 |
| 长时间无业务 frame、Harness 自发 ping、租约同时过期 | dshd 不注入 ping；Harness 控制帧原样通过；租约到期只生成约定的 1013 策略 close | 通过，AC-17 关闭 |
| READY/LEASED 条件字段缺失或不适用状态携带误导字段 | OpenAPI Draft 2020-12 负例确定拒绝，不再依赖实现者阅读 prose | 通过，AC-18 关闭 |
| 只编写测试矩阵、没有实现 runner | validator 明确报告 `44 declared, 0 executed`，不能再把 ID 数量当成行为通过 | 通过，AC-19 关闭 |

### 12.4 机器复验结果与证据边界

2026-08-29 实际执行 `docs/contracts/validate_contracts.py`，结果：

```text
Contract validation: PASS
OpenAPI: 10 paths, 34 schemas, 140 local refs
Examples: 9 schema-validated JSON blocks; 2 conditional variants accepted; 10 negative cases rejected
Trace markers: HLD=14, interface=6
Local links: 47
Conformance specification: 44 declared, 0 executed (implementation required)
```

该 PASS 证明 OpenAPI 语义、本地引用、九个文档示例与对应 schema、两个合法条件状态、十个反例、追踪标记、本地链接和精确行为向量集合一致。它明确不证明 dshd、中央服务、Docker/ECS 或官方 Web UI parity 已经运行通过；这些仍属于 VG-01～VG-03 和 44 个行为向量的实现验收。

### 12.5 AC 关闭状态与最终判断

| 问题 | 状态 | 独立复验结论 |
| --- | --- | --- |
| AC-14 | 关闭 | desired/observed 与 live/local/ready 已分离，合法 STOPPED/FENCED 不会被 healthcheck 隐式逆转 |
| AC-15 | 关闭 | lease deadline 算法、乱序处理和原子失效动作唯一 |
| AC-16 | 关闭 | inventory 与完整 usable predicate 边沿和连续可用 sync epoch 绑定，两种并行顺序及同 generation 恢复均收敛 |
| AC-17 | 关闭 | raw tunnel 与稳态 heartbeat owner 唯一，策略 close 是枚举例外 |
| AC-18 | 关闭 | 条件字段已由 OpenAPI 3.1 机器约束 |
| AC-19 | 关闭 | validator 校验 schema 正反例和精确向量集合，并公开 executed=0 边界 |
| AC-20 | 关闭 | single-attach 与 writer guard 不再存在替代关系 |

> **v1.3 最终判断：总体架构合理，模块目标、工作模式、职责、边界与 Docker 约束清晰；协议具有唯一状态、时钟、触发和连接语义；设计包自洽、逻辑正确且整体一致，可以作为 MVP 实现基线。实现完成前不得把本结论扩张为运行行为、目标 ECS 或官方 Web UI parity 已验收。**

## 13. v1.4 独立验收发现

### 13.1 验收方法与分级

本次不继承 v1.3 的关闭判断，重新固定源码 commit/tag，逐项核对冻结基线、HLD、接口正文、OpenAPI、conformance 和 validator，并使用空白部署、状态 ABA、部分流式响应及非法生命周期联合构造反例。验收对象仍是设计，不把未实现本身判为缺陷；只有设计不能导出唯一安全实现时才记录问题。

| 级别 | 定义 | 数量 |
| --- | --- | --- |
| P0 | 证明总体路线不可行或必须修改 Harness 核心模型 | 0 |
| P1 | 可导致无法首次接入、错误运行结果或互不兼容实现，阻断设计冻结 | 5 |
| P2 | 主流程仍成立，但跨视图、运维输出或机器契约仍不完整 | 3 |

### AC-21（P1）：首次节点身份与 token 绑定无法同时成立

**证据**

- `node_id` 和 `storage_id` 被定义为首次部署时在空白持久卷生成：`central-dshd-interface-spec.md:80-81`；
- 每个 token 又必须预先绑定一个 `node_id`，中央服务对 URL/body 执行绑定校验：`central-dshd-interface-spec.md:96-101`；
- 所有 Registry operation 从第一次注册起就要求该 Bearer token，但 OpenAPI 没有 enrollment operation，也没有注入/预置 node identity 的契约。

**反例与影响**

部署系统只能先注入 token，再启动空白 volume。此时中央服务若已经把 token 绑定到某个 node_id，就必须预先知道 dshd 尚未生成的值；若第一次注册时允许 token 任意认领请求中的 node_id，又违反 token 已绑定和防伪造规则。不同实现只能自行选择“部署预生成”“首次使用绑定”或“新增 enrollment”，首次接入协议不唯一。

**复验条件**

MVP 应选择一个闭环。最小方案是由部署控制面先分配 `node_id + node_token` 并在中央预登记，向容器同时注入 node_id 与 token；dshd 只在空白卷生成 storage_id，并原子写入 identity，已有 identity 必须与注入 node_id 一致。需要补充空白卷、重复启动、错误 node_id/token 和首次注册响应丢失测试。

### AC-22（P1）：inventory 触发没有覆盖 instance/generation ABA

**证据**

- 冻结基线要求每个新 instance/generation 以及可用性恢复都强制对账：`mvp-baseline.md:90`；
- 中央派生状态以 `instance_id + generation + sync_epoch` 查询同步结果：`central-dshd-interface-spec.md:495-508`；
- 实际 job 触发只写为 usable predicate `false→true`：`central-dshd-interface-spec.md:603`；
- `/health/ready` 返回 generation，但派生谓词只写 `reverse_ready_probe_success`，没有要求 probe generation 等于最新接受的 heartbeat generation。

**反例与影响**

中央已有 ONLINE generation N；Harness 在两次心跳之间快速重启，中央下一次直接观察到 READY generation N+1，全部布尔可用条件始终为 true。新 key 的 `inventory_synced` 为 false，节点进入 SYNCING，但规范没有产生新 job 的事件；节点可能永久停在 SYNCING。反向 probe 的旧 generation 成功结果也可能与新 heartbeat 事实组合，形成非同一代的派生状态。

**复验条件**

定义不可混用的 `usable_key = node_id + storage_id + instance_id + lease_id + generation`。当 key 变化或完整谓词 false→true 时都必须创建新 sync epoch；reverse-ready 返回的 generation 必须等于 usable_key generation；任一 key/谓词变化取消旧 job 并使旧结果不可提交。增加未观察到 STARTING 的快速重启、instance CAS、lease 更换和迟到 probe/job completion 测试。

### AC-23（P1）：透明 HTTP 自动重试缺少响应提交边界

**证据**

- HTTP proxy 被要求流式发送 body、ZIP 和 backpressure：`central-dshd-interface-spec.md:425-429`；
- 重试规则仅说“幂等方法可自动重试”，没有规定由谁重试、是否已经向下游提交 headers/body、请求是否可重放、是否仍为同一 generation：`central-dshd-interface-spec.md:562`。

**反例与影响**

Session export GET 已向下游发送 200 和半个 ZIP 后 Harness 连接断开。实现若依据 GET 幂等自动重试，会把第二份 ZIP body 接到第一份后面，或在已提交响应后尝试改写状态，破坏透明性。不同代理库会产生截断、拼接或重复请求三种结果。

**复验条件**

最小且唯一的 dshd 规则应为透明 `/api/**` 不做隐式自动重试，连接错误按是否已提交响应直接传播；需要重试的 create 由中央服务按已定义的 SessionId 协议显式完成。若仍允许代理重试，必须同时限定“未提交任何下游 header/body、请求完整可重放、同一 generation、调用方 deadline 未到”，并加入部分 header/body、chunked upload 和 generation 切换测试。

### AC-24（P1）：OpenAPI operation 没有形成通用错误响应闭包

**证据**

OpenAPI 声明全局 Bearer security，但实际 operation 响应集合中：Registry register 没有 400/401/403；heartbeat 和 deregister 同样没有 401/403；生命周期 POST 没有 400/401/403；operation GET 没有 401/403；只有 status 显式声明 401，且所有 operation 都没有 403。正文错误表却定义了 `INVALID_REQUEST`、`UNAUTHENTICATED` 和 `NODE_ID_MISMATCH`。[OpenAPI](../contracts/central-dshd-openapi.yaml) 当前仍能通过结构校验，因为 OpenAPI security 不会自动生成这些响应。

**影响与复验条件**

生成客户端、mock server 和实现方无法从机器契约获知通用失败集合，正文与 OpenAPI 可产生不同接口。应增加可复用 `BadRequest/Unauthenticated/Forbidden` response，并按 operation 声明所有可达状态；validator 必须检查每个受保护 operation 至少包含 401/403，每个 JSON/受校验输入包含 400，并验证 HTTP status 与 error code 的允许映射。

### AC-25（P1）：Operation schema 允许互相矛盾的生命周期事实

**证据**

实际 Draft 2020-12 反例证明当前 schema 接受：

1. `state=RUNNING` 同时携带 `finished_at + result + error`；
2. `type=STOP, state=SUCCEEDED`，但 `result.harness_state=READY`。

接口正文声称 operation result 按 type 使用判别联合，但 [OpenAPI Operation](../contracts/central-dshd-openapi.yaml)只对 FAILED/SUCCEEDED/no_op 做了部分条件，未封闭 PENDING/RUNNING 字段，也未把 START/STOP/RESTART 与结果状态关联。

**复验条件**

以 `oneOf` 或等价条件联合封闭状态：PENDING/RUNNING 禁止 finished/result/非空 error；FAILED 必须 error+finished 且禁止 result；SUCCEEDED 必须 result+null error+finished；STOP 成功必须 observed STOPPED，START/RESTART 成功必须 READY；RESTART 要求 previous_generation。增加每种 state/type 的正例和逐字段负例。

### AC-26（P2）：生命周期状态图没有覆盖强制停止与抢占优先级

[HLD 状态图](../backend-node-hld.md)只画出 READY→STOPPING，未画 STARTING/AUTHENTICATING/UNHEALTHY 在 operator stop、container shutdown 或 FENCED 下的转换；接口正文又要求 FENCED 从任何运行态立即停止。应固定“FENCED/container shutdown 优先于普通 operation，operator operation 串行”的优先级，并提供完整转换表及 stop-during-start/auth/recovery 测试。

### AC-27（P2）：Status/Logs/Metrics 模块没有封闭输出契约

HLD 将日志和基础指标列为范围内能力，并要求 HTTP error、WS close、child CPU/memory 等指标，但接口只固定 status 与 heartbeat 的部分字段，没有声明 metrics 暴露方式、名称/单位/基数，也没有明确日志仅由 container log driver 消费还是由中央服务读取。应二选一：把 MVP 输出明确收敛为 stdout/stderr + 指定 heartbeat 字段，或增加受保护 metrics 接口；同时从 HLD 删除未承诺的输出。

### AC-28（P2）：Idempotency-Key 的请求体规范化算法未定义

接口要求相同 key 与“相同规范化请求体”复用首次 operation，但未规定 JSON key 顺序、空白、未知字段和缺失可选字段如何参与比较。实现可以使用原始 bytes、语义对象或不同 canonical JSON，导致同一调用被接受或被判 `IDEMPOTENCY_KEY_REUSE`。应固定原始解压 bytes 哈希，或指定一种 canonical JSON 算法及字段参与规则，并增加等价 JSON 与未知字段测试。

### 13.2 真实性与机器复核

固定源码仍为 commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`、tag `dsh-v0.1.2-alpha.1`。重新核对确认：端口 0、实际端口读取、ready URL、authority-bound cookie、Host/Origin fence、Remote mux、默认 30 秒 WebSocket Ping、显式 SessionId create 和 Harness 生成 fork child 均有本地源码证据。因此本轮问题来自外围设计，不是 Harness 能力假设被推翻。

当前 validator 复跑结果：

```text
Contract validation: PASS
OpenAPI: 10 paths, 34 schemas, 140 local refs
Examples: 9 schema-validated JSON blocks; 2 conditional variants accepted; 10 negative cases rejected
Trace markers: HLD=14, interface=6
Local links: 50
Conformance specification: 44 declared, 0 executed (implementation required)
```

该 PASS 只证明现有检查集合通过；AC-21～AC-28 的反例尚未进入 validator/conformance，不能用当前 PASS 关闭这些问题。

### 13.3 架构与边界复核

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 总体技术路线 | 通过 | 原生 Harness + 同容器 dshd + 外部中央控制面仍是可行的最小路线 |
| Docker/进程架构 | 通过 | 单镜像、init→dshd→Harness、loopback、单端口、非 root 和 RW 边界合理 |
| 数据所有权 | 通过 | Harness 业务事实、dshd 节点事实、中央路由事实没有重新混写 |
| 模块主要职责 | 通过 | Supervisor、Bootstrap/Auth、Connection Context、Proxy、Management 和 Central Client 的主边界清晰 |
| 模块输出闭包 | 有条件不通过 | Status/Logs/Metrics 的日志与指标交付方式未唯一化 |
| 中央—dshd 边界 | 通过 | 中央不直连 Harness，dshd 不承担全局调度或 Session 业务解释 |
| 协议与状态闭包 | 不通过 | 首次身份、sync key、重试提交点、operation union 和通用错误响应仍有缺口 |

### 13.4 v1.4 最终判断

> **总体架构合理、Harness 事实可信、核心模块边界基本清晰，但当前设计包存在 5 项 P1 和 3 项 P2；自洽性、逻辑正确性、完整性、协议硬度和整体一致性均未达到冻结标准。修复 AC-21～AC-25，并同步收敛 AC-26～AC-28、把相应反例加入 conformance/validator 后，才能重新作为 MVP 实现基线。VG-01～VG-03 继续保留为实现完成后的验收门槛。**

## 14. v1.5 根因修复独立复验

### 14.1 根因定位

| 共同根因 | 导致问题 | 根本错误 | 根因级控制 |
| --- | --- | --- | --- |
| RC-05 置备权威缺失 | AC-21 | 稳定身份和 credential 分别有规则，却没有一个在空白节点启动前完成二者绑定的 owner/事务 | 部署控制面预登记 node_id/token；dshd 只生成 storage_id；已有 identity 严格等值校验 |
| RC-06 版本事实被压成布尔状态 | AC-22 | false→true 只能发现可用性边沿，不能发现 instance/lease/generation 在两个 true 样本间替换 | usable_key+sync_epoch；probe 等代；job 捕获 key/epoch 并 CAS 提交 |
| RC-07 副作用与提交点没有唯一 owner | AC-23、AC-25、AC-26、AC-28 | “可重试”“已完成”“相同请求”只有意图，没有定义响应提交、状态联合、抢占和指纹算法 | HTTP 单次尝试；Operation state/type 联合；生命周期优先级；RFC 8785 JCS 指纹 |
| RC-08 prose/schema/validator 输出未闭合 | AC-24、AC-27 | HLD 承诺、接口响应、OpenAPI 和验证器覆盖集合不同 | 逐 operation 错误闭包、status-specific error schema、封闭运维输出面和跨契约 drift guard |

这四项是 AC-21～AC-28 的充分共同根因：如果仍由 dshd 随机生成 node_id，首次 token 绑定悖论会复现；如果去掉 usable key/CAS，ABA 或迟到结果会复现；如果允许透明重试或宽松 Operation，半响应/矛盾状态会复现；如果只改 prose，生成客户端和另一实现仍可合法地产生不同协议。

### 14.2 统一解决方案与规范落点

| 控制 | 唯一规则 | 规范和验证证据 |
| --- | --- | --- |
| 首次身份 | 启动前原子分配并预登记 node_id/token；只读注入；空卷只生成 storage_id；mismatch 在 listener/Harness 前退出 | MVP 基线、HLD 8.2/9.1、接口 3.3/4、ID-01～ID-04 |
| 版本化对账 | `usable_key=(node_id,storage_id,instance_id,lease_id,generation)`；key 变化或谓词恢复都新建 epoch；probe 等代；job CAS 提交 | MVP 基线、HLD 9.5、接口 8.4/11.2、SR-08～SR-13 |
| 透明 HTTP | 一次下游请求最多一次 Harness 尝试；提交前 502/504，提交后只终止流；所有方法同规则 | HLD 9.2、接口 7.1/10、PX-11～PX-13 |
| 生命周期与幂等 | 强制停止 > 已接受 operator operation > 自动恢复；Operation 按 state/type 判别；JCS 指纹含全部收到字段 | HLD 9.4、接口 6.3、OpenAPI Operation、ST-11～ST-14、CT-11～CT-14 |
| 错误闭包 | 每个受保护 operation 至少 400/401/403；每个 HTTP status 只接受规定 error code 集合 | OpenAPI reusable responses/coded schemas、validator response traversal、CT-09～CT-10 |
| 运维输出 | 只通过 status/heartbeat 输出固定指标；日志只到 stdout/stderr/container driver；没有 `/metrics` 或日志读取 API | HLD 8.4/13、接口 6.4、StatusResponse/HeartbeatRequest schema、CT-15 |

### 14.3 失败反例复验

| 反例 | 修复后唯一结果 | 结论 |
| --- | --- | --- |
| 空白卷只有 secret，node_id 尚不存在 | 部署不能启动未完成置备的 task；node_id/token 先预登记并同时注入，dshd 无首次认领分支 | AC-21 关闭 |
| 首次注册成功响应丢失并立即崩溃 | 同进程可幂等重试；跨进程未知 predecessor 时等待当前 lease 到期，不覆盖 identity/storage，不冒进接管 | AC-21 关闭 |
| 中央只观察 READY N→READY N+1 | usable key 变化独立触发新 epoch/job，旧 synced marker 不适用，N+1 对账前保持 SYNCING | AC-22 关闭 |
| N 的 ready probe 或 inventory 在 N+1 后完成 | generation/key 或 CAS 不匹配，结果丢弃，不能与新事实拼接 | AC-22 关闭 |
| ZIP 已返回 200 和半个 body 后上游断开 | 下游得到截断流并关闭；没有第二次上游、body 拼接、第二状态码或 JSON envelope | AC-23 关闭 |
| 受保护 operation 缠漏 401/403 或 400 | validator 遍历 8 个 operation 并强制三类响应；缺一即 FAIL | AC-24 关闭 |
| RUNNING 携带 finished/result，或 STOP success=READY | Draft 2020-12 Operation schema 确定拒绝；合法 PENDING/RUNNING/各 type success/FAILED 正例确定接受 | AC-25 关闭 |
| STARTING/AUTHENTICATING 中 stop、FENCED 或 shutdown | 普通 stop 中断自动恢复；冲突 operator 请求返回 409；FENCED/shutdown 优先并经 STOPPING→STOPPED，desired 按 owner 保留或修改 | AC-26 关闭 |
| 两个团队分别实现 Prometheus endpoint 和日志拉取 API | HLD/接口/OpenAPI 明确都不是 MVP surface，唯一必需输出为 status/heartbeat + container logs | AC-27 关闭 |
| 相同幂等 key 使用不同 key 顺序、未知字段或 null | JCS 等价顺序/空白得到同指纹；未知字段变化与 omitted/null 得到不同指纹并返回 reuse conflict | AC-28 关闭 |

### 14.4 机器复验结果与证据边界

2026-08-29 实际执行 `uv run --with-requirements docs/contracts/requirements-contracts.txt python docs/contracts/validate_contracts.py`：

```text
Contract validation: PASS
OpenAPI: 10 paths, 42 schemas, 179 local refs
Examples: 9 schema-validated JSON blocks; 2 status variants accepted; 11 status negatives rejected
Operations: 7 state/type variants accepted; 7 contradictory variants rejected
Errors: 8 protected operations closed; 38 HTTP response mappings checked; 15 coded responses accepted; 8 wrong-code cases rejected
Cross-contract invariants: 9
Trace markers: HLD=14, interface=6
Local links: 50
Conformance specification: 66 declared, 0 executed (implementation required)
```

该 PASS 证明当前 OpenAPI 结构与引用、示例、条件状态、Operation state/type 联合、逐 operation 错误集合、HTTP status/error-code 映射、九条跨契约关键不变量、本地链接和 66 个行为向量编号一致。它不证明 dshd 或中央服务实现、目标 ECS/Docker sandbox、性能容量或官方 Web UI parity 已运行通过；这些继续由 VG-01～VG-03 和行为 runner 验收。

### 14.5 关闭状态与最终判断

| 问题 | 状态 | 独立复验结果 |
| --- | --- | --- |
| AC-21 | 关闭 | 首次身份/token/storage 的生成 owner、顺序、持久化和失败恢复唯一 |
| AC-22 | 关闭 | ABA、probe 和 job completion 都由 usable key+epoch/CAS 隔离 |
| AC-23 | 关闭 | streaming 提交前后语义唯一，不存在透明自动重试 |
| AC-24 | 关闭 | 受保护 operation 和 status-specific error code 已机器闭合 |
| AC-25 | 关闭 | Operation state/type 的合法与矛盾联合均有 schema 正反例 |
| AC-26 | 关闭 | 强制停止、operator 串行和自动恢复的优先级与转换完整 |
| AC-27 | 关闭 | 日志/指标的 transport、字段、consumer 和非目标 API 均明确 |
| AC-28 | 关闭 | 幂等请求指纹算法和字段参与规则确定 |

> **v1.5 最终判断：`Harness Node Daemon（dshd）+ 原生 DeepSeek Harness` 后端总体架构合理，模块目标、工作模式、职责、边界和 Docker 约束一致；中央服务与 dshd 的身份、状态、时序、代理、生命周期、错误与运维契约足够硬。设计包达到 MVP 实现输入标准。实现完成前不得把本结论扩张为运行行为、目标 ECS 安全兼容性或官方 Web UI parity 已验收。**

## 15. v1.6 独立设计验收

### 15.1 验收原则与工作边界

本轮不继承 v1.5 的通过判断，重新以当前文件和固定源码为依据。验收对象是 MVP 后端设计，不是尚未存在的 dshd/中央服务实现。只有以下情况计为设计问题：核心流程无法执行、两个规范给出互斥结果、owner/状态/副作用边界不唯一、关键协议无法由独立团队兼容实现，或设计违反已冻结的“不改 Harness、只增加外围管理层”目标。

以下内容不作为设计不通过理由：尚未执行实现级行为测试、尚未在目标 ECS 验证 sandbox、没有在缺乏容量数据时虚构 SLO、MVP 未实现跨节点迁移/自动故障转移，以及私网 MVP 暂未采用 mTLS。它们分别属于既有实现门槛、合理未知或已批准范围外事项；若部署网络不再可信，接口规范已明确要求 TLS/mTLS 作为上线前置条件。

### 15.2 独立结论总表

| 验收维度 | 独立结论 | 判定依据 |
| --- | --- | --- |
| 自洽性 | 通过 | 冻结基线、HLD、接口、OpenAPI 和 conformance 对身份、状态、健康、租约、generation、同步、代理和生命周期采用同一语义 |
| 真实性 | 通过（设计阶段） | 固定 Harness commit/tag 与本地源码一致；动态端口、ready URL、authority cookie、Host/Origin fence、Remote WS、显式 SessionId create 和内部生成 fork ID 均有源码依据 |
| 逻辑正确性 | 通过 | 空白置备、中央失联、ABA、迟到结果、半响应、fork 不确定结果、FENCED 和并发生命周期反例均有唯一且保守的结果 |
| 完整性 | 通过（MVP 范围） | Docker/进程/目录/权限/端口、身份、管理、代理、Session 路由收敛、故障、日志指标和数据 owner 均已覆盖；范围外明确 |
| 总体架构合理性 | 通过 | `中央服务 → dshd → 原生 Harness` 保持单一控制点和事实来源，不复制 Harness 业务模型，符合最小外围改造路线 |
| 模块定义与边界 | 通过 | Configuration、Supervisor、Bootstrap/Auth、Connection Context、HTTP/WS Proxy、Management、Auth、Observability、Central Client 的输入、职责和禁止事项一致 |
| 协议与契约硬度 | 通过 | Registry/Management 有 OpenAPI 3.1；透明 HTTP/WS 有行为契约；状态、错误、operation、幂等、重试和提交边界均可验证 |
| 整体一致性 | 通过 | 未发现局部修复破坏冻结目标、Docker 边界、数据所有权或其他协议视图；当前开放项都是实现门槛而非设计矛盾 |

问题分级结果：`P0=0，P1=0，P2=0`。本轮没有为了形成新发现而把实现细节、生产增强项或范围外能力升级为设计缺陷。

### 15.3 真实性独立复核

目录重整前核验的来源 HEAD 为 `cd5ef8148158c3a752a658978873241fdf8e2bbc`，exact tag 为 `dsh-v0.1.2-alpha.1`；当前 `dsh/` 是不含嵌套 Git 的冻结快照。关键源码事实如下：

- WebServer 明确允许 port 0，并在 listen 后读取 OS 分配的实际端口：`dsh/packages/host/webserver/src/index.ts:58-63,143-151,292-299`；
- Web App 在 Loader settle 后打印带 launch token 的 authenticated ready URL：`dsh/packages/bundle/web-app/src/index.ts:263-281`；
- cookie name 和签名 audience 绑定 exact authority，验证时再次比较 authority：`dsh/packages/client/connection/src/browser-auth.ts:69-107,245-296`；
- API 先执行 Host/Origin trust fence，再执行 browser authentication：`dsh/packages/client/connection/src/rpc-host.ts:95-98`；
- Harness 是 Remote WebSocket ping 的 owner，默认间隔 30000ms：`dsh/packages/api/gateway/src/stream-server.ts:26-75`、`dsh/packages/api/gateway/src/index.ts:114-176`；
- create 接受显式 SessionId 并调用 ensureSession，fork 则在 Harness 内生成 child ID：`dsh/packages/api/session-controller/src/types.ts:269-313`、`commands.ts:72-110,185-275`。

因此，设计依赖的 Harness 通信与 Session 行为没有建立在虚构接口上。developer preview 带来的未来 API 变化风险仍由固定版本、成对发布和 parity contract test 控制，不构成当前固定版本的真实性问题。

### 15.4 逻辑反例复演

| 反例 | 当前设计导出的唯一结果 | 判定 |
| --- | --- | --- |
| 空白 volume 首次启动 | 部署先预登记并注入 node_id/token；dshd 只生成 storage_id；identity mismatch 在启动业务前 fail closed | 闭环 |
| 中央服务从冷启动前不可达 | desired=RUNNING 时 Harness 本地启动并守护；registration DEGRADED，live/local 可用而 ready/proxy 关闭 | 不把控制面故障错误传播为本地进程故障 |
| 快速重启只观察到 READY N→READY N+1 | usable_key 变化强制新 sync epoch；N+1 inventory 成功前保持 SYNCING | 不遗漏对账 |
| 旧 ready probe/inventory 迟到 | generation/key 或 CAS 不匹配，迟到结果不能提交 | 不混用代际事实 |
| ZIP 已返回部分 body 后 Harness 断开 | 终止已提交响应流，不透明重试、不拼接第二份 ZIP、不追加错误 envelope | 保持流式正确性 |
| create/fork 响应丢失 | create 用固定 SessionId 向同节点显式重试；fork 不重试，通过同节点 inventory 补齐 child 路由 | 避免重复副作用和孤儿路由 |
| STARTING/AUTHENTICATING 期间 stop、FENCED 或 shutdown | 普通 operator operation 串行；FENCED/shutdown 优先；observed 经 STOPPING 收敛，desired 按对应 owner 保留或修改 | 状态与意图不混淆 |
| operator STOPPED 后容器重启 | desired=STOPPED 持久保留；dshd live，Harness 不隐式 spawn；Docker health 不把合法停止当故障 | 合法停止稳定 |
| 旧实例和替代实例重叠 | single-attach volume 是跨 task 写权保证；storage/instance/lease fencing 管网络权；writer guard 只作本地纵深防御 | 不依赖单一软租约防双写 |

### 15.5 协议与机器契约复核

实际执行：

```text
uv run --with-requirements docs/contracts/requirements-contracts.txt python docs/contracts/validate_contracts.py
```

结果：

```text
Contract validation: PASS
OpenAPI: 10 paths, 42 schemas, 179 local refs
Examples: 9 schema-validated JSON blocks; 2 status variants accepted; 11 status negatives rejected
Operations: 7 state/type variants accepted; 7 contradictory variants rejected
Errors: 8 protected operations closed; 38 HTTP response mappings checked; 15 coded responses accepted; 8 wrong-code cases rejected
Cross-contract invariants: 9
Trace markers: HLD=14, interface=6
Local links: 50
Conformance specification: 66 declared, 0 executed (implementation required)
```

独立检查验证器实现确认：它实际遍历受保护 operation、检查 400/401/403、核对 HTTP/error mapping、构造 Operation 矛盾对象、注入错误 code 负例并精确核对七组行为向量，不是只检查 YAML 能否解析。透明 Harness payload 没有被错误地重新建模；其不可由 OpenAPI 表达的流式、WebSocket 和竞态语义由 66 个 conformance 向量约束，这种分工对 MVP 合理。

### 15.6 保留的实现验收门槛

| 门槛 | 当前状态 | 为什么不阻断设计 |
| --- | --- | --- |
| 66 个 conformance 行为向量 | 已声明，`0 executed` | 当前没有 dshd/中央实现可执行；规范已诚实区分 declared 与 executed |
| VG-01 目标 ECS/Docker sandbox | 待真实镜像验证 | 依赖目标内核/runtime，不可仅凭 HLD证明 |
| VG-02 官方 Web UI parity E2E | 待端到端实现验证 | API 存在性不等于代理实现无损 |
| VG-03 故障与竞态 runner | 待实现 | 设计已给出唯一期望，仍需代码和目标环境证明实际兑现 |
| 性能、容量和资源规格 | 待基线压测 | 缺少事实数据时不应在 HLD 中臆造数值；当前 streaming/backpressure 方向可测试 |

这些门槛必须在“实现完成”或“可上线”验收中通过，但不应倒置为要求当前设计文档证明尚不存在的运行结果。

### 15.7 v1.6 最终判断

> **独立验收通过。后端总体架构合理，模块目标、工作模式、职责和禁止边界清楚；冻结基线、HLD、接口、OpenAPI 与行为契约在身份、状态、时序、代理、生命周期、错误、数据和运维视图上保持一致。协议硬度足以支持独立团队实现 MVP，且没有超出“只在原生 Harness 外增加分布式管理层”的工作边界。当前设计整体一致性达标。该结论仅覆盖设计，不替代实现、目标 ECS、安全上线和官方 Web UI parity 验收。**

# 16. v1.8 六要素问题修复记录（非独立验收）

## 16.1 共同根因

1. 总体目标把 dshd 的 Registry client 与 Management/Proxy server 两个相反方向压缩成“向中央提供接口”，造成职责所有权含混。
2. 端口从固定值改为可配置后，只修订了传输结果，没有定义中央实际可达 endpoint 的配置来源，留下地址推导和端口映射空洞。
3. “后端验收”和“系统集成验收”没有分层，使范围外的真实中央实现成为后端镜像隐含依赖。
4. 非 root 安全约束与 `1..65535` listener 范围独立形成，未检查特权端口反例。
5. VG-01 要求目标 ECS 结果，却未把环境身份作为验收输入冻结，结果不可重复。

## 16.2 统一解法与反例检查

| 问题 | 统一控制 | 失败反例 | 解法是否覆盖 |
| --- | --- | --- | --- |
| 接口方向 | 明确 dshd→中央 Registry；中央→dshd Management/Proxy | 实现方在 dshd 暴露 register server | 是；总目标、接口矩阵和 OpenAPI server owner 一致 |
| 可达 endpoint | 部署必填 `DSHD_ADVERTISE_URL` 和 `DSHD_CENTRAL_BASE_URL`；禁止自动推导 | container 8080 映射 host 18080，dshd 错报 8080 | 是；advertised port 可与 listener 不同，中央按策略校验和反向 probe |
| 非 root 端口 | listener 限制 `1024..65535`，外部 80/443 只做运行时映射 | UID 10001 无 capability 绑定 443 失败 | 是；无需增加容器权限 |
| 后端验收边界 | 契约一致中央 reference stub 是强制门；真实中央联调是系统级证据 | 中央尚未实现导致 dshd 永远不能验收 | 是；后端可独立完整验证，真实联调仍保留 |
| ECS 可复现性 | M8 前冻结并记录验收环境清单 | 不同 kernel/volume driver 的结果被视为同一环境 | 是；环境漂移触发重新验收 |

## 16.3 状态边界

上述修复不改变 dshd + 原生 Harness 架构，不增加运行服务，不修改 Harness，也不把中央实现纳入后端范围。中央 reference stub、配置矩阵和环境清单属于工程/验收资产。修复后的机器契约校验结果应记录在后续独立验收中；本节只记录设计维护，不能继承或生成新的独立通过结论。

## 16.4 修复后机器检查

设计维护完成后执行既有契约验证器，结果为 `PASS`：OpenAPI 仍为 10 paths/42 schemas/179 local refs；受保护 operation、错误映射、状态/type 正反例均保持闭合；跨契约不变量由 9 增至 16，新增检查覆盖显式 advertise endpoint、非特权 listener、中央 reference stub 和验收环境清单；66 个行为向量仍诚实记录为 `declared, 0 executed`。该结果证明本次修复没有破坏机器契约并已形成跨文档约束，但不证明尚未实现的运行行为。

# 17. v1.9 路线图问题修复记录（非独立验收）

## 17.1 共同根因

路线图把能力范围、验收工具、阶段依赖和目标环境作为隐含前提，没有将它们定义为有版本、有生产阶段、有消费阶段的显式资产。因此总体架构虽然成立，M8 却无法证明全部目标能力均被覆盖，也可能在最终验收阶段才开始开发测试工具或发现环境假设失效。

## 17.2 统一解法与反例检查

| 问题 | 统一控制 | 失败反例 | 解法是否覆盖 |
| --- | --- | --- | --- |
| Web UI 完整性不可判定 | 冻结 `WUI-001`～`WUI-021`，每项绑定 transport、阶段、inventory contract 和 parity E2E | 少量 UI 演示通过但遗漏 Approval | 是；缺少任一 ID 或任一证据均失败 |
| 验收工具无建设阶段 | M1 建骨架、M2～M6 增量补齐、M7 完成并冻结、M8 只执行 | M8 才开始编写 66-vector runner | 是；M7 出口门阻止无工具候选进入 M8 |
| 阶段依赖含混 | 固定 `M0 → M1 → M2 → M3 → {M4,M5,M6} → M7 → M8` | M3 越过 M2 并行实现 lifecycle | 是；M3 明确消费 M2 状态和进程输出 |
| ECS 假设发现过晚 | M7 候选形成前冻结验收环境并预检关键架构前提 | M8 才发现目标 volume 不具备 single-attach | 是；假设失效会在候选形成前阻断 |

## 17.3 状态边界

这些修复没有改变 v1.0 冻结六要素的目标、边界、约束、交付物或验收含义。能力清单、reference stub、runner、覆盖报告和环境清单均为工程或验收资产，不是新增运行服务；Harness 源码、存储、Agent runtime 和 Session 模型保持不变。本节只记录问题修复，后续仍需独立验收确认整体设计状态。

## 17.4 修复后机器检查

契约验证器实际结果为 `PASS`：能力清单固定为 21 个 `WUI-*`、4 个 `DSHD-*` 和 9 个 `OUT-*`；8 项路线图门禁通过；OpenAPI 保持 10 paths/42 schemas/179 local refs，16 项跨契约不变量保持通过；66 个行为向量继续诚实记录为 `declared, 0 executed`。该结果证明缺失能力 ID、旧阶段依赖、验收工具后置或环境冻结后置会被静态门禁发现，但不证明尚未实现的 dshd、镜像或运行 E2E 已通过。
