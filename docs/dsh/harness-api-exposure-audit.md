# DeepSeek Harness 后端 API 暴露审计

> 审计对象：`dsh web` Host surface  
> 源码基线：`cd5ef8148158c3a752a658978873241fdf8e2bbc`（`dsh-v0.1.2-alpha.1`）  
> 文档性质：事实审计（informative），不覆盖 MVP 基线、HLD 或中央服务—dshd 接口规范  
> 审计目的：确认 dshd 透明代理能够取得哪些 Harness 能力与信息。

## 1. 结论

不能笼统地说 Harness “暴露了内部所有能力”。准确结论是：

1. **当前官方 Web UI 已使用的能力基本都已暴露**，dshd 完整代理 `/api/**` 与 `/api/remote.mux` 后，可以达到现有 Web 产品能力的等价覆盖。
2. **部分 Harness 内部能力只暴露了状态，没有暴露直接操作接口**，主要是 background jobs 和 persistent terminal。
3. **部分产品能力在 Harness 中本身不存在**，例如会话删除、unarchive、会话导入和强制关闭。
4. **节点运维信息不是 Harness Web API 的职责**，例如 PID、CPU、内存、磁盘、进程日志和健康状态，需要 dshd 自行提供。

因此，若 MVP 的“所有会话特性”定义为“对齐当前官方 Web UI”，现有 API 足够；若定义为“管理 Harness 内部所有运行资源”，现有 API 不足。

## 2. 已完整暴露

| 能力域 | 已暴露能力 | 载体 |
|---|---|---|
| 会话目录 | list、search、create | Remote HTTP |
| 会话操作 | rename、fork、prompt、cancel | Remote HTTP |
| Pending queue | 查看、edit、remove、steer | control stream + Remote HTTP |
| 历史 | page、follow、断线续接 | Remote HTTP + stream |
| Session 状态 | added、removed、activity、running、error | Remote events |
| 实时投影 | queue、jobs view、projection values | control stream |
| 模型 | model catalog、select model、provider list、model discovery | Remote HTTP |
| 设置 | describe、update、replace、mutate | Remote HTTP |
| 凭据 | describe、set、unset | Remote HTTP |
| Workspace | create、rename、remove registration、排序、archive session、follow | Remote HTTP + stream |
| Agent Preset | list、read、copy、delete、select | Remote HTTP |
| Slash Commands | list、execute | Remote HTTP |
| Goal | create、edit、pause、resume、complete、clear | Scoped Remote |
| Subagent | list、prompt、interrupt | Remote HTTP |
| 文件/会话引用 | candidates/list | Remote HTTP |
| 附件 | prompt admission、读取 | Remote HTTP |
| 消息反馈 | list、put、delete | Remote HTTP |
| Approval | 请求与结果回传 | waterfall event |
| User Questions | 请求与答案回传 | waterfall event |
| 插件 | inventory；Web 动态 Cordis 操作 | Remote HTTP + events |
| 会话导出 | Session 及子会话、附件 ZIP | `GET/HEAD /api/session.export` |

Session Controller 的方法全集见 [源码](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/index.ts#L208-L391)。Web 应用明确挂载 agent presets、commands、settings、goals、LLM、dynamic Cordis、plugin inventory、message feedback、session references、subagents、session 与 workspace 等 Remote contribution：[Remote assembly](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/remotes/src/client/index.ts#L4-L14) [mount list](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/remotes/src/client/index.ts#L158-L160)。

Approval 和 user questions 属于可回传结果的 waterfall event，不只是通知：[event allowlist](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/remotes/src/remote-events.ts#L15-L32)。会话 ZIP 是独立 Fetch route，不属于 Typert Remote：[session export](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/session-query/session-log-export/src/index.ts#L34-L87)。

## 3. 部分暴露

| 能力 | 已暴露 | 未暴露 |
|---|---|---|
| Background jobs | id、kind、label、status、detail、时间 | 面向用户的直接 read/wait/kill Remote |
| Persistent terminal | 工具调用参数、结果和输出会进入 Session event，可供 UI 渲染 | 面向用户的直接 list/send/read/signal/close Remote |
| Workspace 文件 | Workspace 注册、目录选择/列出/创建目录、Agent 工具执行结果 | 通用远程文件管理 API |
| Credentials | 是否存在、元信息、写入和删除 | 读取 secret 明文，且这是有意限制 |
| Session archive | archive/hide | unarchive |
| 插件状态 | Loader plugin inventory 和动态面板能力 | 操作系统级进程、端口和资源状态 |

`session/control` 确实给出了 jobs 的可显示快照，但只包含状态字段，没有 job read/wait/kill 方法：[SessionJob 与 control baseline](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/types.ts#L478-L508)。Job 的完整操作存在于进程内 `ctx.jobs` 和模型工具层，而非当前 Web Remote。[Jobs contract](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/jobs/jobs/README.md#L32-L49)

Terminal 的 spawn/send/read/signal/kill/list 同样是进程内服务和模型工具能力，不是 Web Remote。[Terminal contract](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/terminal/terminal/README.md#L44-L56)

## 4. 当前不存在或未暴露

### 会话管理

- 删除会话及其持久化数据；
- 显式关闭/释放一个会话 Agent；
- 会话 unarchive；
- 会话 ZIP 导入/恢复；
- 直接读取或修改原始 Session persistence 文件；
- 单独取消一个任意 tool call，当前主要是取消整个 active Agent turn。

Workspace 文档明确指出 session deletion 是 absent capability，且 archive 目前是单向的：[Workspace limitations](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/workspace/workspace/README.md#L156-L164)。

### 节点运行信息

- Harness 结构化 health/readiness API；
- PID、进程 uptime；
- CPU、内存、磁盘和系统负载；
- stdout/stderr 日志查询；
- 当前监听端口的结构化查询；
- 结构化 Harness version/commit/capability handshake；
- 启动、停止和重启 API。

这些内容由 dshd 从子进程和操作系统取得，不要求 Harness 暴露。

## 5. 对 dshd 方案的影响

dshd 的透明代理必须覆盖：

```text
所有 HTTP 方法 /api/**
WebSocket upgrade /api/remote.mux
连接取消与关闭
HTTP streaming response
```

不能只代理 JSON POST，因为 `/api/session.export` 使用 `GET`/`HEAD` 和流式 ZIP Response。

dshd 能外围补齐的内容：

- health、PID、uptime、CPU/内存/磁盘；
- stdout/stderr 日志；
- Harness start/stop/restart；
- Harness version。

Session list 仍通过 Harness 原有 API 取得；dshd 只透明代理，不建立、解析或上报第二份 Session 索引。需要修复中央路由映射时，由中央服务调用目标节点的 Harness Session API 对账。

dshd 不能在“不改 Harness”前提下透明补齐的内容：

- Session delete；
- Session unarchive；
- 直接 Job read/wait/kill；
- 直接 Terminal list/send/read/signal/close；
- Session import；
- Harness 内部任意未 Remote 化的 Cordis Service。

若这些能力进入 MVP，就需要新增 Harness Remote/plugin，违反当前“原生 Harness 不改造”的冻结基线，必须另行确认。

## 6. MVP 判定

以“当前官方 Web UI 能做什么，分布式后端就能做什么”为验收口径：**满足**。

以“外部系统可以控制 Harness 内部每一种资源”为验收口径：**不满足**。

对应能力已经固化为 [Web 能力冻结基线](harness-web-capability-baseline.md)及其[机器清单](../contracts/harness-web-capabilities.yaml)，并按以下三类建立稳定 ID：

```text
官方 Web UI 能力 / dshd 节点补齐 / MVP 排除能力
```

本事实审计继续作为源码证据，不覆盖该规范性能力基线。后端验收必须逐项输出 `WUI-*` 的 inventory contract 与 parity E2E 证据，不能用抽象的“所有能力”或少量演示流程代替。
