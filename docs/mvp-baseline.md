# DeepSeek Harness 分布式管理 MVP 基线

状态：**已冻结**  
冻结日期：2026-08-29

| 版本 | 日期 | 修订内容 | 目标变化 |
| --- | --- | --- | --- |
| v1.0 | 2026-08-29 | 冻结 MVP 目标、边界、部署形态和职责分工 | 初始冻结 |
| v1.1 | 2026-08-29 | 澄清单写卷、冷启动、Session 路由登记与文档优先级，消除后续设计歧义 | 无；不改变“不改 Harness、外围分布式管理”的目标 |
| v1.2 | 2026-08-29 | 固化持久化运行意图、三类健康消费者、单调租约、READY 后对账和 WebSocket 控制帧所有权 | 无；修复外围管理设计，不改变 MVP 目标 |
| v1.3 | 2026-08-29 | 固化节点身份预置、版本化 Session 对账键、透明 HTTP 不重试和最小运维输出面 | 无；关闭外围协议竞态，不修改 Harness |
| v1.4 | 2026-08-29 | 纠正 dshd 端口约束：单一服务端口可配置，8080 仅为默认值 | 无；保持 dshd 单入口和 Harness 不暴露原则 |
| v1.5 | 2026-08-29 | 固化显式 advertise/central endpoint 配置、非特权 listener 范围和中央 reference stub 后端验收边界 | 无；闭合部署与验收，不增加运行服务 |
| v1.6 | 2026-08-29 | 将官方 Web UI 能力口径固化为稳定能力 ID 和机器清单，并明确逐项验收规则 | 无；把既有 parity 目标变为可验证基线，不增加产品能力 |

## 基准结论

MVP 不改造 DeepSeek Harness 的存储、运行时或会话模型，只在其外部增加一层分布式管理。

后端 MVP 的能力目标是：**完整复刻当前官方 DeepSeek Harness Web UI 的能力**。

“完整能力”以当前官方 Web UI 实际使用的 Host API、Remote、事件流与 Fetch 路由为准，不扩展为对 Harness 内部所有 Cordis Service、进程内资源或尚未进入 Web UI 的能力进行管理。

规范性的能力集合以 [Web 能力冻结基线](dsh/harness-web-capability-baseline.md)及其[机器清单](contracts/harness-web-capabilities.yaml)为准。每个 `WUI-*` 必须同时取得 inventory contract 与 parity E2E 证据；`DSHD-*` 表示外围节点补齐能力；`OUT-*` 表示明确不属于 MVP 的能力。固定源码事实审计只提供证据，不另建能力口径。

后端以 Docker 镜像发布。每个容器内只运行一个 `dshd` 和一个由其管理的 DeepSeek Harness；`dshd` 只负责同一容器内的 Harness，不发现、不连接、不管理容器外的 Harness 进程。

中央服务与后端节点的唯一交互对象是 `dshd`。中央服务不得绕过 `dshd` 直接访问 Harness；Harness 不感知中央服务。`dshd` 主动向中央服务注册并持续发送心跳，中央服务通过节点私网地址调用 `dshd` 的管理 API、Harness 业务代理和实时事件代理。

## MVP 架构

```text
前端
  │
  ▼
中央管理服务
  ├── 节点管理
  ├── 会话管理
  ├── 会话到节点的映射
  ├── API 请求转发
  └── 实时事件流转发
  │
  ├───────────────┬───────────────┐
  ▼               ▼               ▼
ECS Node A      ECS Node B      ECS Node C
dshd            dshd            dshd
  │               │               │
Harness         Harness         Harness
```

## 组成部分

1. **DeepSeek Harness**：保持原有实现，负责单节点内的会话及全部会话特性。
2. **Harness Node Daemon（`dshd`）**：部署在每台 ECS，管理并代理本机 Harness，向中央服务注册、发送心跳并转发 API 与事件流。该名称取代 Node Agent，避免与 Harness 内部 Agent 概念混淆。
3. **中央管理服务**：维护节点信息及会话到节点的映射，对前端提供统一 API。
4. **前端**：只访问中央管理服务，不直接管理各节点上的 Harness。

## 中央服务与 dshd 的职责边界

- 中央服务拥有全局节点目录、节点可用性判断、节点选择、会话到节点映射、用户认证授权和统一请求路由；
- `dshd` 拥有本容器运行事实，包括 Harness 生命周期、连接 generation、本地认证引导、代理连接、节点状态与资源信息；
- Harness 拥有会话、消息、附件、设置、运行时与 Workspace 数据；中央服务和 `dshd` 均不建立第二份 Harness 业务状态；
- `dshd` 只验证中央服务的服务身份，不承担终端用户、租户或全局会话权限判断；
- 节点注册和心跳由 `dshd` 主动发起；管理命令、业务请求和 WebSocket 连接由中央服务通过 ECS 私网发起；
- 中央服务失联时，`dshd` 不停止 Harness，而是继续本地守护并重试注册；租约失效后节点业务 readiness 撤回，中央服务停止向该节点分配或转发业务；Docker/ECS 容器健康只检查 dshd liveness，不把中央租约、Harness READY、合法 STOPPED 或 FENCED 当作容器死亡；
- 节点或 Harness 故障不会在 MVP 中触发会话迁移，原有 Session 数据仍留在该节点的 `DSH_HOME`。

## Docker 部署边界

- 发布单元是同时包含 `dshd` 和固定版本 DeepSeek Harness 的单一 Docker 镜像；
- 容器运行时负责容器级启动、停止和重启；
- `dshd` 负责容器内 Harness 子进程的启动、停止、守护和 API 代理；
- 一个容器内最多存在一个由 `dshd` 管理的活动 Harness；
- Harness 仅监听容器内 loopback，不直接暴露容器端口；
- 容器只发布 `dshd` 的一个可配置 TCP 服务端口；HTTP、WebSocket 和守护管理 API 共用该端口，默认值为 `8080`，非 root MVP listener 范围为 `1024..65535`；外部低端口使用运行环境映射，Harness 使用容器内 loopback 动态端口且不发布；
- 部署控制面必须显式注入 `DSHD_ADVERTISE_URL` 和 `DSHD_CENTRAL_BASE_URL`；dshd 不猜测中央实际可达地址，配置缺失或非法时在 listener/Harness 前失败；
- `/var/lib/dsh` 与 `/workspace` 是两个可写 volume；其中 `DSH_HOME=/var/lib/dsh/state`，运行用户 `HOME=/var/lib/dsh/home`；镜像程序目录和配置保持只读；
- 部署控制面在启动空白节点前成对分配并预登记 `node_id + node_token`：`node_id` 以只读配置注入，token 以 `/run/secrets/dshd-node-token` 注入；dshd 只为新 volume 生成 `storage_id`，不得让未绑定 token 在首次请求中认领任意 node_id；
- `/var/lib/dsh` 是逻辑节点专属的单写 volume；同一时刻只能挂载给一个活动后端容器，禁止使用可被多个在线任务同时读写的共享 NFS/EFS 目录承载同一 DSH_HOME；`/workspace` 若与该节点业务状态绑定，也遵循相同的单写替换约束；
- dshd 在 `/var/lib/dsh/dshd` 持久化 Harness 的 operator desired state，默认 `RUNNING`；显式 stop 后容器重启不得自动改回 RUNNING，instance fencing 强制停止当前 Harness 但不篡改 operator desired state；
- 容器固定以非 root UID/GID `10001:10001` 运行，volume 必须预先允许该 UID/GID 读写；
- 镜像默认禁用 Harness 原生会话遥测，Session 内容不得绕过 dshd/中央服务边界直接上传外部 collector；
- `dshd` 不挂载 Docker socket，不管理其他容器，也不管理宿主机上的 Harness。

后端镜像的独立交付验收使用项目随附、契约一致的中央 reference stub 覆盖 Registry server 与 dshd client 接口；真实中央服务联调属于系统级兼容验收，不进入 dshd 后端实现边界，也不作为后端镜像自身合格的前置条件。目标 ECS 验收前必须冻结并记录架构、launch type、OS/kernel、container runtime、网络/端口映射、volume driver 和容器安全选项。

## 核心工作流

### 创建会话

```text
前端请求
→ 中央服务预生成 Harness Session ID 并选择节点
→ 中央服务先保存 Session ID 与节点的 CREATING 映射
→ dshd 原样代理显式 Session ID 的 create 到本机 Harness
→ 成功后中央服务把映射改为 ACTIVE
→ 返回同一 Session ID
```

Harness 自行生成 ID 的 fork 等派生流程由中央服务在源 Session 所在节点执行；成功后登记返回的 child Session ID。结果不确定时不得盲目重试，中央服务使用该节点现有 Session list 对账并补齐路由。每个新的 `node_id + storage_id + instance_id + lease_id + generation` 版本键，以及可用谓词失效后的再次恢复，都建立新的 `sync_epoch` 并执行强制 Session inventory 对账；反向 ready 的 generation、心跳事实和同步提交必须属于同一版本键，迟到结果不得提交。只有有效租约、反向 ready、daemon READY、desired RUNNING、observed READY、版本兼容和当前 epoch 对账成功同时成立时，节点才接收新 Session 调度。Subagent child 固定继承 parent Session 的节点路由，不触发跨节点调度。

透明 Harness `/api/**` 请求在 dshd 和中央转发链路上都不做基础设施级自动重试；未提交响应时返回明确代理错误，已提交 headers/body 后只终止该响应流。create/fork 等业务恢复只使用本基线规定的显式幂等或对账流程。

### 操作会话

```text
前端请求
→ 中央服务查询会话所在节点
→ 请求转发到对应 dshd
→ dshd 调用本机 Harness
→ 结果或事件流经中央服务返回前端
```

## 冻结边界

MVP 范围内：

- 管理多台 ECS 上的 Harness 节点；
- 通过统一 API 管理节点和会话；
- 完整代理当前官方 Web UI 使用的 Harness API、实时事件流和下载路由；
- 保持当前官方 Web UI 的功能和交互语义；
- 维护会话与所属节点之间的路由关系。
- 构建并发布包含 `dshd` 与固定 Harness 版本的 Docker 镜像；
- 明确容器目录、volume、读写权限、运行用户和端口开放设计。

MVP 范围外：

- 修改或替换 Harness 的会话存储；
- 修改 Harness 的 Agent 运行时；
- 修改 Harness 原有会话模型；
- 暴露或管理当前官方 Web UI 未使用的 Harness 内部能力；
- 实现跨节点共享会话存储；
- 实现会话跨节点迁移或自动故障转移；
- 将 Harness 内部能力重新实现于中央管理服务。

## 后续工作约束

后续需求分析、架构设计、接口设计、开发计划和验收标准均以本文件为基准。

规范性文档发生冲突时，按“本冻结基线 → 已批准 HLD/ADR → 中央服务—dshd 接口规范及其机器 schema”定位并修复，不允许实现方自行选择解释。调研、可行性分析、GAP review 和能力审计属于事实证据或说明材料，不覆盖规范性结论。

任何需要改造 Harness 存储、运行时或会话模型的方案，均视为超出当前 MVP，必须单独提出并重新确认，不能作为默认实现路径。
