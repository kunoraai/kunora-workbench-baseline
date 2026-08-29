# 分布式 DeepSeek Harness 后端 MVP GAP Review

> 文档性质：历史调研（informative）。文中的 `Node Agent` 已由正式架构定名为 `dshd`；任何接口、状态或部署结论以 `mvp-baseline.md`、`backend-node-hld.md` 和 `central-dshd-interface-spec.md` 为准。  
> 基线：不修改 DeepSeek Harness 的存储、运行时或会话模型，只在外部增加分布式管理层。  
> 源码基线：`cd5ef8148158c3a752a658978873241fdf8e2bbc`（`dsh-v0.1.2-alpha.1`）  
> Review 日期：2026-08-29

## 1. Review 结论

后端 MVP 可按“原生 DeepSeek Harness + Node Agent”实现。

- **原生 Harness 的业务能力已经基本就绪**：会话、历史、实时事件、提示、排队、取消、分叉、模型、设置、Workspace、附件、审批、用户问题和子代理等能力已经由 Web Host API 提供。
- **原生 Harness 缺少的是服务化接入外壳**：它当前面向本机浏览器，而不是面向中央管理服务。
- **Node Agent 当前不存在，需要新建**：它负责进程托管、本机认证、协议透明代理、健康状态、注册和心跳，不负责重新实现 Harness 会话逻辑。

因此，MVP 的主要开发量在 Node Agent 和中央管理服务；Harness 本身不需要做存储、运行时或会话模型改造。

## 2. MVP 中两个组件的关系

```text
Central Service
    │
    │ Node API + transparent Harness tunnel
    ▼
Node Agent
    ├── Process Supervisor
    ├── Local Auth Bootstrap
    ├── HTTP / WebSocket Bridge
    ├── Health / Inventory
    └── Registration / Heartbeat
             │
             │ localhost only
             ▼
DeepSeek Harness Web Host
    ├── Session Controller
    ├── Typert Gateway / Remotes
    ├── Remote event stream
    └── Original DSH_HOME / Workspace / Runtime
```

Node Agent 对 Harness 的业务协议采用透明转发。除节点管理接口外，不在 Node Agent 中重新定义一套 session API。

## 3. 原生 DeepSeek Harness：现状与 GAP

### 3.1 已经具备的能力

| 能力 | 当前状态 | MVP 是否可直接使用 |
|---|---|---:|
| 安装与启动 | 已发布 `@deepseek-ai/dsh`，可运行 `npx @deepseek-ai/dsh web` | 是 |
| 无浏览器启动 | 支持 `dsh web --no-open --port 3080` | 是 |
| 本地服务 | 默认监听 `127.0.0.1:3080` | 是，正适合由本机 Agent 接管 |
| 启动就绪信号 | Loader 完成后打印带 token 的 `dsh web:` URL | 是，Agent 可解析 |
| Unary API | HTTP POST `/api/<namespace>/<method>` | 是 |
| 实时流 | WebSocket `/api/remote.mux`，承载多个逻辑 stream | 是 |
| 会话管理 | list、search、create、rename、fork、prompt、cancel、queue、page、follow、control | 是 |
| 其他功能 | settings、credentials、workspace、goal、LLM、subagent、plugin inventory 等 Remote | 是 |
| 交互事件 | approval 与 user questions 使用可回传结果的 waterfall event | 是，但必须完整代理双向 stream |
| 优雅停止 | SIGTERM 触发 dispose，最多等待 5 秒 | 是 |
| 本地配置 | `DSH_HOME`、环境变量、profile patch | 是 |

主要证据：

- Web profile 的启动、端口和就绪行为：[Web App README](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/bundle/web-app/README.md#L32-L54)
- Session Controller API：[源码](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/index.ts#L208-L391)
- Remote 能力装配：[客户端装配](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/remotes/src/client/index.ts#L158-L160)
- approval、user questions 等事件：[事件 allowlist](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/remotes/src/remote-events.ts#L15-L32)
- 进程收到 SIGTERM 后的有界清理：[CLI shutdown](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/apps/cli/src/process-shutdown.ts#L1-L73)

### 3.2 Harness 面向 MVP 的 GAP

| GAP | 现状 | MVP 最小补齐方式 | 是否修改 Harness |
|---|---|---|---:|
| 无中央服务认证 | 当前是浏览器 launch token → cookie | Node Agent 在 localhost 完成 token/cookie 交换，对外使用 Agent 自己的认证 | 否 |
| 无公开服务地址 | Web Host 只监听 loopback | Node Agent 暴露受控端口，转发到 localhost Harness | 否 |
| 无 `/health` | 就绪通过 stdout URL 宣告 | Agent 结合子进程状态、就绪行和 API/stream 探测生成健康状态 | 否 |
| 无节点信息 API | Harness 只报告有限 Host 信息 | Agent 上报 node id、版本、PID、端口、启动时间和状态 | 否 |
| 无节点注册/心跳 | 单机应用没有集群概念 | Agent 向中央服务注册并定时 heartbeat | 否 |
| 无统一会话路由 | Harness 只知道自己的 session id | 中央服务维护 session → node 映射；Agent 不参与全局路由 | 否 |
| API 是浏览器内部协议 | Typert Remote 与 Web Client 同版本构建 | MVP 固定 Harness 版本，并透明转发原协议 | 否 |
| Client 包偏 Web 环境 | npm metadata 标记为 `platform: web` | Agent 不直接重写 Client；首选转发原始 HTTP/WS frame | 否 |
| Web profile 依赖前端 dist | 即便 Agent 不使用 UI，profile 仍会加载静态前端 | 使用已发布构建产物；MVP 接受这部分冗余 | 否 |
| 无服务化 start/stop API | 通过命令行与操作系统信号控制 | Agent 管理子进程并将 start/stop/restart 变成 Node API | 否 |

这里的关键点是：这些都是**外围集成 GAP**，不是 Harness 会话能力 GAP。

### 3.3 Harness 本机认证如何由 Agent 接管

现有认证流程是：

```text
Harness 启动
→ stdout 打印 http://127.0.0.1:PORT/?token=...
→ 浏览器 GET /?token=...
→ Harness 返回签名 Cookie
→ 后续 HTTP 与 WebSocket 携带 Cookie
```

Node Agent 可以完全复用该流程：

```text
Agent 启动 Harness 子进程
→ 解析 stdout 中的就绪 URL
→ Agent 请求 token URL，不自动跟随 303
→ 保存 Set-Cookie
→ Agent 代理请求时注入 Host/Cookie
→ Agent 建立本地 WebSocket 时注入 Host/Origin/Cookie
```

launch token 仅用于本机 Agent 与 Harness 之间，不发送给中央服务或前端。现有实现只允许根路径交换 token，普通 API 不接受 Authorization header：[Browser Auth](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/client/connection/README.md#L35-L39)。

## 4. Node Agent：从零到 MVP 的 GAP

Node Agent 是新的独立组件，建议使用 TypeScript/Node.js 实现。它的职责应保持很薄。

### 4.1 模块清单

| 模块 | 需要实现的内容 | MVP 优先级 |
|---|---|---:|
| Agent Config | node id、中央地址、认证 token、DSH_HOME、workspace、Harness 命令和端口 | P0 |
| Process Supervisor | 启动、停止、重启 Harness；捕获 stdout/stderr；监控退出码 | P0 |
| Auth Bootstrap | 解析启动 URL；交换并维护本机 Harness cookie | P0 |
| Harness HTTP Bridge | 透明代理 `/api/**` 的方法、headers、body、status 和 response | P0 |
| Harness WS Bridge | 双向代理 `/api/remote.mux`，保持 binary/text/control/close 语义 | P0 |
| Node Control API | describe、health、start、stop、restart | P0 |
| Registry Client | 注册、心跳、断线重试、重新注册 | P0 |
| Session Reconciliation | 启动后调用 `session/list`，让中央服务恢复已有会话路由 | P0 |
| Metrics/Logs | 基本结构化日志、启动失败和代理错误计数 | P1 |
| Upgrade Manager | 下载和切换 Harness 版本 | MVP 后 |

### 4.2 Node Agent 最小 API

```text
GET  /v1/node
GET  /v1/health
POST /v1/harness/start
POST /v1/harness/stop
POST /v1/harness/restart

ANY  /v1/harness/api/**
WS   /v1/harness/api/remote.mux
```

`GET /v1/node` 最小返回：

```json
{
  "nodeId": "ecs-01",
  "agentVersion": "0.1.0",
  "harnessVersion": "0.1.2-alpha.1",
  "harnessState": "READY",
  "startedAt": "2026-08-29T09:00:00Z"
}
```

`GET /v1/health` 最小返回：

```json
{
  "status": "UP",
  "process": "RUNNING",
  "api": "READY",
  "eventStream": "CONNECTED"
}
```

### 4.3 Node Agent 状态机

```text
STOPPED
   │ start
   ▼
STARTING
   │ observe `dsh web:` URL
   ▼
AUTHENTICATING
   │ cookie obtained + API probe succeeds
   ▼
READY
   │ process exit / probe failure
   ▼
UNHEALTHY
   │ restart
   └──────────────► STARTING

READY ── stop/SIGTERM ──► STOPPING ──► STOPPED
```

中央服务只应把 `READY` 节点用于新请求。

### 4.4 为什么使用透明桥接

Node Agent 有两种实现方向：

1. 逐个实现 `session.create`、`session.prompt`、`settings.*` 等业务接口；
2. 透明转发 Harness 的 `/api/**` 与 `/api/remote.mux`。

MVP 应选择第二种。

原因：

- 新增 Harness Remote 时 Agent 不需要同步增加业务代码；
- history/follow/control 的序列和重连语义不被二次翻译；
- approval 和 user questions 的 waterfall 请求与结果能原样往返；
- cancellation、错误 envelope 和 WebSocket stream 保持 Harness 原始语义；
- 更符合“外围增加管理层、不重写 Harness”的冻结基线。

Node Agent 只需要识别协议层信息，不需要理解 Session event 内容。

## 5. 从启动到可服务的完整流程

```text
1. Node Agent 启动
2. 读取本机配置与 nodeId
3. 启动：dsh web --no-open --port <localPort>
4. 设置本机 DSH_HOME 和 workspace cwd
5. 捕获 stdout/stderr
6. 等待 `dsh web: ...?token=...` 就绪行
7. 使用 token 交换本机 Cookie
8. 建立 `/api/remote.mux` 并等待 `$events` ready frame
9. 调用 `session/list` 读取本机已有会话
10. 向中央服务注册节点及会话摘要
11. 进入 READY，开始代理 HTTP/WS
12. 定时发送 heartbeat
```

Harness 文档明确把 URL 行定义为监督方可使用的就绪信号，而且只在 Loader 树结算、Connection 认证可用后输出：[就绪宣告](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/bundle/web-app/README.md#L76-L80)。

## 6. 会话与事件流需要补齐什么

### 6.1 普通会话调用

中央服务根据 session → node 映射，把请求交给目标 Agent；Agent 原样转发。

Harness `SessionCreateRequest` 已允许调用方指定 session id，因此中央服务可以直接生成全局唯一 id并传给 Harness，不必额外维护两套 id。[SessionCreateRequest](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/types.ts#L274-L280)

### 6.2 实时流

必须代理以下内容：

- `$events`：Host 通知、approval、user questions；
- `session/follow`：会话持久事件；
- `session/control`：队列、jobs 和实时状态；
- `workspace` 等其他 Remote stream。

不能只代理 HTTP POST，否则页面可以创建和读取会话，但无法完整工作。

### 6.3 断线处理

MVP 中 Agent 不需要实现业务重放，只需要：

- 本地 Harness WebSocket 断开时关闭上游对应 tunnel；
- 中央服务/前端按 Harness Client 原有逻辑重新建立 stream；
- Agent 重启 Harness 后重新交换 cookie、重新注册并重新上报 session list。

Gateway 已经包含 Remote stream 的重连、snapshot 和 journal gap repair 机制：[Gateway Remote Stream](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/gateway/README.md#L44-L48)。

## 7. 配置与部署 GAP

每台 ECS 至少准备：

```text
/opt/dsh-agent/
  agent application
  agent config

/var/lib/dsh/
  DSH_HOME

/workspace/
  Harness default workspace
```

Node Agent 启动 Harness 时固定：

```text
DSH_HOME=/var/lib/dsh
workingDirectory=/workspace
command=dsh web --no-open --port 3080
```

MVP 部署镜像应预装并固定 Harness 版本，不能在每次启动时通过未固定版本的 `npx` 临时下载。源码当前处于 developer preview，明确可能产生 breaking changes：[项目状态](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/README.md#L9-L18)。

## 8. MVP 验收清单

### Harness + Agent 生命周期

- Agent 能启动 Harness，并准确进入 READY；
- Harness 启动失败时 Agent 返回明确错误；
- Agent 能通过 SIGTERM 停止 Harness；
- Harness 意外退出后 Agent 能标记 UNHEALTHY 并重启；
- Agent 重启后能重新取得 cookie 并恢复代理。

### 会话主链路

- list、create、prompt、page、follow、control；
- rename、fork、selectModel、updateQueue、cancel；
- session id 由中央服务生成并被 Harness 接受；
- 现有本机会话在 Agent 重启后能重新上报。

### 完整功能链路

- settings 与 credentials 写入；
- workspace 管理；
- 附件上传/读取；
- approval 请求与结果回传；
- user questions 请求与答案回传；
- subagent 列表、prompt 与 interrupt；
- WebSocket 断开后能够重新连接。

### 代理正确性

- HTTP status、body 和 Harness RPC error 不被改写；
- WebSocket frame 顺序不变；
- 客户端取消能关闭对应的下游调用/stream；
- 不把 Harness launch token 和 cookie 暴露给中央服务或前端。

## 9. 工作量判断

| 部分 | 现状成熟度 | MVP 工作性质 |
|---|---:|---|
| Harness 会话业务 | 高 | 直接复用和集成验证 |
| Harness 本地 Web transport | 高 | 直接复用 |
| Harness 服务化运行契约 | 低 | 由 Node Agent 外围补齐 |
| Node Agent | 尚不存在 | 新组件开发 |
| 节点注册与心跳 | 尚不存在 | 新组件开发 |
| HTTP/WS 透明桥接 | 尚不存在 | 新组件开发 |
| 全功能端到端验证 | 尚不存在 | 新测试体系 |

总体判断：这不是对 Harness 内核的分布式改造，而是一个“进程托管 + 协议网关 + 节点注册”的工程。MVP 的最大技术风险是正确代理 Harness 的 multiplexed WebSocket 和 waterfall 交互事件，而不是会话存储或 Agent runtime。

## 10. 推荐实施顺序

1. 单机 Agent 启停 Harness、解析就绪 URL并完成 cookie 交换；
2. 完成 unary HTTP 透明代理，验证 list/create/prompt/page/cancel；
3. 完成 `/api/remote.mux` 双向代理，验证 follow/control；
4. 验证 approval 和 user questions waterfall；
5. 增加 node describe、health、注册和心跳；
6. 增加启动时 session reconciliation；
7. 接入中央服务进行两台 ECS 的会话路由验收。

完成第 4 步即可证明“外围代理不损失 Harness 会话特性”；完成第 7 步即可认为分布式后端 MVP 准备就绪。
