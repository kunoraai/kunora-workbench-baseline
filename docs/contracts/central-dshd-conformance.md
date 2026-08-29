# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | Agent | 固化中央服务—dshd 的单写、状态、认证、透明代理、Session 路由、隐私和故障一致性测试向量。 | [HLD-01][IFACE-01][ACCEPT-01] |
| v1.1 | 2026-08-29 | Agent | 增加 desired/observed、monotonic lease、usable-edge inventory、raw WebSocket 和条件 schema 的正反例，并明确设计向量与已执行测试的证据边界。 | [HLD-01][IFACE-01][ACCEPT-01] |
| v1.2 | 2026-08-29 | Agent | 增加首次身份置备、usable-key ABA、流式提交边界、完整生命周期、Operation/error 联合、JCS 幂等和运维输出边界向量。 | [HLD-01][IFACE-01][ACCEPT-01] |
| v1.3 | 2026-08-29 | Agent | 将 endpoint 必填配置、非特权 listener、端口映射、中央 reference stub 和冻结验收环境纳入既有向量与通过规则。 | 用户要求、[HLD-01][IFACE-01][ACCEPT-01] |
| v1.4 | 2026-08-29 | Agent | 明确 reference stub/runner 在 M7 前完成、M8 只执行，并将逐项 Web UI 能力覆盖与 66 个节点一致性向量分离验收。 | 用户要求、[HLD-01][CAPABILITY-01][ACCEPT-01] |
| v1.5 | 2026-08-29 | Agent | 随工作区模块化整理更新 HLD、接口、能力和验收引用路径；行为向量不变。 | 用户要求、[HLD-01][IFACE-01][CAPABILITY-01] |

# 中央服务—dshd MVP 一致性测试规范

## 1. 目的与规范关系

本文件定义无法仅由 OpenAPI 表达的时序、不变量和透明代理行为。Registry/Management 字段由 [OpenAPI 3.1](central-dshd-openapi.yaml) 校验，行为语义由 [接口规范](../interfaces/central-dshd-interface-spec.md)定义。本文件的用例 ID 是设计、实现和验收之间的稳定追踪键。[HLD-01][IFACE-01][OPENAPI-01]

## 2. 根因—设计控制矩阵

| 根因 | 设计控制 | 能否在不改 Harness 下解决 | 关键验证 |
| --- | --- | --- | --- |
| node_id 本地生成与 token 预绑定互相依赖 | 部署控制面预登记 node_id/token；只读注入 node_id；dshd 只生成 storage_id，identity mismatch fail closed | 是 | ID-01～ID-04 |
| 中央 lease 只能 fencing 网络所有权，不能 fencing DSH_HOME writer | 节点专属单写 volume、稳定 storage_id、本地 writer guard、STALE 后停止 Harness | 是 | CF-01～CF-04 |
| daemon liveness、Harness observed state 与 operator desired state 混用 | 持久 desired state；正交 observed state；Docker/ECS 只用 live，local/ready 分别诊断和承载 | 是 | ST-01～ST-07 |
| 租约绝对时间依赖 wall clock，响应延迟和乱序可错误延长本地 lease | monotonic deadline、完整 RTT 和安全余量；过期后重新注册 | 是 | ST-08～ST-10 |
| Harness cookie/握手绑定 exact authority，WebSocket frame 所有权未唯一化 | generation 级 canonical connection context；对齐握手后的 raw frame tunnel；稳态 heartbeat 只由 Harness 产生 | 是 | PX-01～PX-10 |
| create 和 fork 的 ID/幂等能力不同 | create 显式 ID；fork 单次调用、持久 intent 和同节点 Session inventory 对账 | 是 | SR-01～SR-07 |
| inventory 只看布尔边沿，READY→READY ABA 和迟到结果可混代 | usable_key+sync_epoch、reverse-ready generation 等值、job CAS 提交 | 是 | SR-08～SR-13 |
| 流式响应没有可安全透明重试的提交点 | `/api/**` 单次上游尝试；提交前 error、提交后只终止流 | 是 | PX-11～PX-13 |
| 生命周期优先级与 Operation/type 联合未封闭 | 强制停止优先级、状态转换表、OpenAPI 判别联合 | 是 | ST-11～ST-14、CT-11～CT-12 |
| Markdown、OpenAPI 和验证器只约束局部结构 | operation 响应闭包、status-code schema、正反例和 executed/declaration 分离 | 是 | CT-01～CT-15 |
| 原生 Web profile 有默认出站遥测 | 镜像强制关闭 telemetry | 是 | PV-01～PV-03 |
| listener 不能推导中央实际可达地址，非 root 也不能可靠绑定特权端口 | 部署显式注入 advertise/central URL；listener 限制非特权端口；外部低端口只做映射 | 是 | ID-01～ID-04、CT-02 |

## 3. 首次身份置备

| ID | 场景 | 必须观察到的结果 |
| --- | --- | --- |
| ID-01 | 空白 volume + 已预登记 node_id/token + 合法 `DSHD_ADVERTISE_URL`/`DSHD_CENTRAL_BASE_URL`，分别覆盖默认 listener、非默认 listener 和外部端口映射 | dshd 校验注入值，只生成 storage_id 并原子写 identity；只监听配置的非特权端口，逐字注册 advertised endpoint；中央以已绑定 token 鉴权、首次绑定 storage_id 并能 reverse-ready |
| ID-02 | 已有 identity.node_id 不匹配，或必填 endpoint 缺失/含 userinfo/path/query/fragment，或 listener port 小于 1024/大于 65535 | dshd 在打开 listener 或 spawn Harness 前退出；不得覆盖 identity、猜测 endpoint 或尝试注册 |
| ID-03 | 中央接受首次注册但 response 丢失，随后进程继续或崩溃 | 同进程以相同 instance 重试得到同一 lease；若进程崩溃且未写 last instance，新进程等待旧 lease 到期后接入，不猜测 predecessor、不改变 storage_id |
| ID-04 | token 未绑定、绑定其他 node_id、同 node_id 使用新 volume storage_id，或 advertised endpoint 不符合预登记/部署策略 | 分别返回 401/403/409/422；中央不得实施首次使用认领、替换已绑定 storage_id 或代理到未获准地址 |

## 4. 单写与 fencing

| ID | 场景 | 操作 | 必须观察到的结果 |
| --- | --- | --- | --- |
| CF-01 | 同一 volume 启动两个 dshd | 第一个持有 writer guard 后启动 Harness；第二个竞争同一 guard | 第二个不得 spawn Harness，保持不可 local/ready，并报告 `WRITER_GUARD_HELD` |
| CF-02 | 不同 volume 伪造同一 node_id | 使用不同 storage_id 注册 | 中央返回 `409 STORAGE_ID_MISMATCH`，不得替换当前 lease |
| CF-03 | 旧 instance 延迟心跳 | successor 已取得 lease 后发送旧 lease heartbeat | 中央返回 `409 STALE_INSTANCE`；旧 dshd 关闭业务连接、停止 Harness observed process、释放 guard 并进入 FENCED，但不改写持久 desired state |
| CF-04 | 中央网络分区且旧 Harness 仍运行 | lease 过期后尝试从另一 task 挂载同一 volume | 部署层必须拒绝同时挂载；测试不得以 writer guard 代替跨 task single-attach 保证；旧节点 local 可用但 ready/proxy 不可用 |

这些用例证明：即使中央服务无法通知旧实例，第二个 Harness 也不能取得同一 DSH_HOME 写权；因此 fencing 不依赖“旧实例一定能收到消息”的错误假设。[HLD-01]

## 5. 启动、状态与健康

| ID | 场景 | 必须观察到的结果 |
| --- | --- | --- |
| ST-01 | desired 文件不存在且中央服务从启动前不可达 | dshd 原子创建默认 RUNNING；listener 与 Harness 正常启动；registration 为 REGISTERING/DEGRADED；live=200、local=200、ready=503；无业务 proxy |
| ST-02 | ST-01 后中央恢复 | 同一 instance 取得 lease；无需重启 Harness；dshd ready=200，中央先进入 SYNCING，对账成功后才转 ONLINE |
| ST-03 | 已租约节点中央中断超过本地 monotonic deadline | desired/observed 保持 RUNNING/READY，live/local=200、ready=503；未完成 HTTP 被取消、WS 以 1013 关闭；中央不再调度 |
| ST-04 | 收到明确 STALE_INSTANCE | registration=FENCED；observed 最终 STOPPED 而原 desired 不变；live=200、local/ready=503；start/restart/proxy 返回 NODE_FENCED；部署控制器停止旧 task 以释放 single-attach volume |
| ST-05 | desired=RUNNING 且未 FENCED 时 Harness crash | readiness 撤回；旧 generation HTTP 失败、WS 以 1012 关闭；按退避恢复并发布 N+1 generation |
| ST-06 | operator stop 完成后 dshd 或容器重启 | stop 在 signal 前持久化 STOPPED；重启后 Harness 仍为 observed STOPPED，不自动 spawn；显式 start/restart 才原子改为 RUNNING |
| ST-07 | Harness 长时间 UNHEALTHY/STOPPED，或 registration FENCED | dshd live 始终 200，Docker/ECS 不因 local/ready=503 替换容器；诊断和管理接口仍可用 |
| ST-08 | lease 期间 wall clock 向前或向后跳变 | 本地 deadline 不改变；wall clock 只影响显示和日志 |
| ST-09 | heartbeat response 延迟、乱序或服务端 lease 时间对不一致 | `server_time`/`lease_expires_at` 必须由同一权威时钟原子生成且差值在 TTL 内；deadline 预算扣除完整 RTT 与安全余量；低于 accepted_sequence 的响应不延长 deadline；响应晚于旧 deadline 时重新注册而不直接复活 lease |
| ST-10 | monotonic deadline 与新 proxy 同时发生 | 单一原子状态迁移先撤回 ready，拒绝新 proxy，取消未完成 HTTP 并以 1013 关闭 WS；deadline 后不存在仍可承载业务的窗口 |
| ST-11 | operator stop 发生在自动 STARTING/AUTHENTICATING/UNHEALTHY recovery | 没有活动 operator operation 时先持久化 desired=STOPPED，中断自动流程，经 STOPPING 在 stop timeout 内收敛 STOPPED |
| ST-12 | START/RESTART operation 执行中收到普通 STOP | 返回 `409 OPERATION_CONFLICT`，不抢占已接受 operation；调用方等待其终态后重试 |
| ST-13 | 任意非 STOPPED observed state 收到明确 FENCED | FENCED 优先，未完成 operation 以 NODE_FENCED 失败，observed 经 STOPPING→STOPPED，desired 保留 |
| ST-14 | 任意非 STOPPED observed state收到 container/dshd shutdown | shutdown 优先，未完成 operation 以 DAEMON_STOPPING 失败，observed 有界 STOPPED，desired 保留供下次启动恢复 |

## 6. Canonical authority 与 HTTP 代理

| ID | 输入/故障 | 必须观察到的结果 |
| --- | --- | --- |
| PX-01 | ready URL 为 `http://127.0.0.1:32123/?token=...` | token exchange、probe、HTTP、WS 的 Host 都是 `127.0.0.1:32123` |
| PX-02 | 实现尝试用 `localhost:32123` 复用 cookie | 合约测试失败；不得把该 generation 标记 READY |
| PX-03 | 外部请求携带 Authorization/Cookie/Host/Origin/Forwarded/X-Forwarded-*/Sec-Fetch-* | Harness 侧捕获不到任何外部值，只看到 exact Host/cookie 和缺失或 same-origin Origin |
| PX-04 | `Connection: keep-alive, X-Hop` 且携带 X-Hop | Connection、Keep-Alive、X-Hop 均不进入 Harness |
| PX-05 | Harness 响应含 Connection 点名 header、Transfer-Encoding、Set-Cookie | 上述连接级 header 和 Set-Cookie 不到达中央服务；body/status 保持 |
| PX-06 | Harness 响应伪造 `X-DSHD-Generated: true` | header 被移除；仅 dshd 自己产生的错误可设置该值 |
| PX-07 | Harness 返回本地 absolute Location | 重写为相同 path/query/fragment 的相对 Location，不暴露 loopback authority |
| PX-08 | Session export GET/HEAD、大 ZIP、慢消费者 | 不完整缓冲；支持 backpressure/cancel；HEAD 无 body |
| PX-09 | remote.mux Upgrade | 外部 key/version/subprotocol/extensions 逐项对齐到 Harness，只替换 Host/Cookie/认证相关 header；只有双方协商一致并返回匹配 101 后进入隧道 |
| PX-10 | remote.mux 二进制/文本/fragment/ping/pong/close | raw frame 的类型、顺序、fragment、mask 规则和 Harness close 语义逐帧保持；中央与 dshd 的节点 leg 均禁用自动 ping；仅 generation=1012、lease=1013、FENCED=1008 是明确的 dshd 策略 close |
| PX-11 | GET/HEAD 在任何 response headers 提交前连接失败或超时 | 每个 relay 只有一次上游尝试；返回一个 502/504 dshd error，不因方法幂等而重试 |
| PX-12 | Session ZIP 已提交 200 和部分 body 后 Harness 断开 | 下游流被截断/关闭；不得启动第二次上游、拼接 body、改写 status 或追加 JSON envelope |
| PX-13 | chunked request 尚未完成时调用方断开或 generation 切换 | 取消唯一上游尝试，不缓存、重放或发送到新 generation |

## 7. Session 路由收敛

| ID | 场景 | 必须观察到的结果 |
| --- | --- | --- |
| SR-01 | 普通 create | 中央先持久化 `CREATING(session_id,node_id)`，再以同一显式 SessionId 调用 Harness，成功后置 ACTIVE |
| SR-02 | create 响应丢失 | 使用相同 node、SessionId、cwd/workspace 和 preset 重试；只存在一个 Session |
| SR-03 | fork 成功 | fork 前持久化 intent；成功后把返回 child ID 映射到 source node |
| SR-04 | fork 响应丢失 | 不自动重试；调用同一 node 的 Session list；所有未映射普通 Session 都登记到该 node |
| SR-05 | 多个新 child 造成操作归属不确定 | 路由全部补齐；fork intent 可以 UNKNOWN，但不存在不可路由 child，也不重复 fork |
| SR-06 | subagent child | 始终使用 parentSessionId 的 node；childSessionId 不独立调度 |
| SR-07 | 相同 SessionId 已在另一 node 映射 | 标记 ROUTE_CONFLICT，拒绝写操作，不静默覆盖 |
| SR-08 | 注册先完成、Harness 后 READY | 可用谓词 false→true 时只建立一个 `(usable_key,sync_epoch)` inventory job；中央先 SYNCING，对账成功才 ONLINE 和接收新 Session |
| SR-09 | Harness 先 READY、注册后完成，首次 list 失败，随后同 generation 失租再恢复 | 得到 lease 后触发可用谓词边；按 1/2/4 秒至 30 秒、20% jitter 重试且不重复并发；谓词失效取消并作废旧 sync epoch，恢复后必须建立新 epoch 重新对账 |
| SR-10 | 中央连续样本从 READY generation N 直接到 READY N+1 | usable_key 变化即建立新 epoch/job，即使没有观察到 false/STARTING；旧 inventory 标记不适用于 N+1 |
| SR-11 | storage/instance/lease 任一字段变化而前后可用谓词均为 true | 任一 key 变化都作废旧同步并进入 SYNCING；新 key 对账成功前不接收新 Session |
| SR-12 | generation N 的 reverse-ready 200 在心跳已更新为 N+1 后到达 | 因返回 generation 与当前 usable_key 不等被丢弃，不能与 N+1 心跳组合成 ONLINE |
| SR-13 | 旧 key/epoch inventory job 在新 job 后完成 | 提交 CAS 失败，旧结果不得写 synced/ONLINE；只有当前 key+epoch 成功结果可提交 |

## 8. 身份、幂等与隐私

| ID | 场景 | 必须观察到的结果 |
| --- | --- | --- |
| CT-01 | OpenAPI 文档加载 | OpenAPI 3.1 语法和所有本地 `$ref` 有效 |
| CT-02 | 缺失 required 字段、错误 UUID/enum、超大控制 JSON | 分别返回 INVALID_REQUEST 或 PAYLOAD_TOO_LARGE；不能进入业务处理 |
| CT-03 | 同一 Idempotency-Key 与相同请求重放 | 返回第一次 operation，不重复执行 |
| CT-04 | 同一 Idempotency-Key 更换 path/body | 返回 `409 IDEMPOTENCY_KEY_REUSE` |
| CT-05 | 控制 JSON、request headers 和并发处理 | 解压后 JSON 超过 65536 bytes 返回 413；header section 超过 65536 bytes 在路由前被拒；dshd 不产生应用层 429，代理保持 backpressure/cancel |
| CT-06 | 接口规范中的九个 JSON 示例 | 每个示例按固定顺序分别通过 RegistrationRequest/Response、HeartbeatRequest/Response、StatusResponse、LifecycleRequest、两个 Operation 和 ErrorResponse schema，而不只是 JSON 解析 |
| CT-07 | 条件状态正反例 | Draft 2020-12 接受无 process 字段的 STOPPED/UNREGISTERED，以及保留 desired RUNNING 的 FENCED/STOPPED；删除 desired_state、READY 删除任一 process 字段、LEASED 删除任一 lease 时间均拒绝；STOPPED 携带 process 字段、UNREGISTERED/REGISTERING 携带 lease 时间也拒绝 |
| CT-08 | 只存在本规范而尚无 dshd/中央实现 | 验证器精确核对全部向量 ID，并输出“declared=N, executed=0”；不得把向量数量表述为已通过行为测试 |
| CT-09 | 遍历所有受保护 OpenAPI operation | 每个 operation 至少声明 400/401/403；公开 health 明确 `security: []` 且不强加认证错误 |
| CT-10 | 对 400/401/403/404/409/413/422/426 response schema 注入错误 code | 只接受对应的 INVALID_REQUEST、UNAUTHENTICATED、NODE_ID_MISMATCH、NOT_FOUND、冲突集合、PAYLOAD_TOO_LARGE、INVALID_ADVERTISE_URL、PROTOCOL_UNSUPPORTED |
| CT-11 | PENDING、RUNNING、SUCCEEDED START/STOP/RESTART、FAILED Operation 正例 | 每个正例只携带本 state/type 允许字段，全部通过 Draft 2020-12 schema |
| CT-12 | RUNNING 携带 finished/result/error，STOP success 返回 READY，RESTART success 缺 previous_generation | 每个矛盾对象均被 schema 拒绝 |
| CT-13 | 相同 Idempotency-Key 使用 key 顺序/空白不同但 JCS 等价的 JSON | 指纹相同并返回第一次 operation，不重复执行 |
| CT-14 | 相同 key 的 body 增加/改变未知字段，或 optional omitted 与 explicit null 互换 | 指纹不同并返回 `409 IDEMPOTENCY_KEY_REUSE` |
| CT-15 | status/heartbeat 与日志输出面 | status/heartbeat 精确包含规定指标；不存在 `/metrics` 或日志读取 API；stdout/stderr 行具备字段且 secret/body 已移除 |
| PV-01 | 新 token 轮换注册成功 | 中央原子提升 next token；旧 token 的 Registry/Management/Proxy 调用均失败 |
| PV-02 | 检查 Harness 环境 | `DSH_TELEMETRY_MODE=DISABLED` 且 `DSH_TELEMETRY_DISABLED` 非空 |
| PV-03 | 执行 `/feedback` 并监测出站 | UI/命令披露 sharing disabled；没有会话 telemetry collector 出站 |

## 9. 通过规则

- ID、CF、ST、PX、SR、CT、PV 七组必须全部通过；不接受用“低概率”豁免首次身份、单写、重复副作用、凭据泄漏或路由丢失。
- 允许 fork operation 在网络故障后保持 `UNKNOWN`，但不允许因此产生重复 fork 或未登记的可见 Session。
- 允许中央服务故障期间 Harness 继续本地运行，但不允许未持有 lease 的节点接受中央业务流量。
- 本文件当前定义的是待实现的行为向量；只有机器 validator 实际执行 schema/文档检查。行为向量在实现测试 runner 前一律记录为 `declared`、`executed=0`，不得据此声称后端行为已经验收通过。
- 后端镜像的强制行为验收使用项目随附、契约一致的中央 reference stub；真实中央服务联调属于系统级兼容证据，不得成为后端镜像自身合格的隐含依赖，也不得替代 stub 的故障注入覆盖。
- reference stub、66-vector runner 和能力覆盖工具必须在 M1 建立骨架、随 M2～M6 增量补齐，并在 M7 出口前完成、自检和版本冻结；M8 只能使用冻结工具执行验收，不得在最终验收中开发或改变验收语义。
- M7 候选镜像形成前必须选择并冻结验收环境清单，至少记录 CPU 架构、ECS launch type、OS/kernel、container runtime、network mode/端口映射、volume driver/single-attach 语义、资源配置和容器安全选项，并预检 single-attach、非 root、只读 rootfs、私网可达和端口映射前提；M8 必须复用同一清单。实际环境不一致时结果不得复用，本地开发机结果不能替代目标环境结果。
- 66 个向量验证节点身份、状态、透明传输和跨接口一致性，不替代 [CAPABILITY-01] 的官方 Web UI 能力验收。M8 对每个 `WUI-*` 还必须同时保存 inventory contract 与 parity E2E 证据；缺失、未执行或失败的 ID 均使 parity 失败。

## 10. 参考文献

| 标记 | 来源 | 说明 |
| --- | --- | --- |
| [HLD-01] | [后端节点 HLD](../backend-node-hld.md) | 节点架构、单写、状态和安全边界 |
| [IFACE-01] | [中央服务—dshd 接口规范](../interfaces/central-dshd-interface-spec.md) | 行为语义、错误、重试和流程 |
| [ACCEPT-01] | [独立验收报告](../acceptance/backend-independent-acceptance.md) | 本轮根因和验收问题来源 |
| [OPENAPI-01] | [OpenAPI 3.1 契约](central-dshd-openapi.yaml) | Registry/Management 字段、必填性、枚举与错误结构 |
| [CAPABILITY-01] | [Web 能力冻结基线](../dsh/harness-web-capability-baseline.md)与[机器能力清单](harness-web-capabilities.yaml) | 官方 Web UI 能力稳定 ID、阶段和逐项验收规则 |
