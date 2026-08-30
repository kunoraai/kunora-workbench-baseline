# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-30 | Agent | 冻结里程碑 M2「进程与认证」的六要素定义。本文件从属于路线图级冻结六要素，不改变任何上层冻结语义。 | 用户要求（M1 验收通过后进入 M2）、[ROADMAP-01] §17.2 M2 行、[CONTRACT-01] ID/CF/ST 向量 |

# 里程碑 M2「进程与认证」六要素

| 项目 | 内容 |
| --- | --- |
| 文档状态 | **已冻结**（v1.0） |
| 冻结日期 | 2026-08-30 |
| 所属路线图 | dshd MVP 开发路线图（[ROADMAP-01] §17，v1.3） |
| 阶段位置 | `M0 → M1 → M2 → M3 → {M4,M5,M6} → M7 → M8` 中的 M2；直接依赖 M1（已完成） |
| 实现技术栈 | Rust 单一原生二进制（[ROADMAP-01] §8.1）；容器内 Node.js 24 仅为 Harness 子进程运行时 |

## 0. 定位与从属关系

本文件是路线图 §17.2 中 M2 行的六要素展开，从属于整条路线图的冻结六要素（[ROADMAP-01] §17.1，v1.0）：

1. M2 六要素不得扩大或改变路线图级六要素的目标、边界、约束、交付物和验收含义；
2. M2 的出口门禁以路线图 §17.2 原文为准：“**dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行**”；
3. 本文件自 v1.0 起冻结。任何改变六要素含义的修订，必须取得用户明确确认、提升本文件版本，并同步复验受影响的上层基线；不改变含义的实现细化不构成解冻。

## 1. 最终目标

dshd 在本阶段获得**进程与认证**能力：能够从持久 desired state 出发，以单写守护（flock/writer guard）启动、探测、认证、守护固定 Harness 子进程，在崩溃/停止/重启下按 generation 恢复，并使 66-vector runner 中的 ID/CF/ST 基础场景具备真实可执行证据。

| 目标 | 成功判据 | 依据 |
| --- | --- | --- |
| 状态协调可用 | desired/observed 正交；原子持久化 desired；单一原子状态迁移（STARTING/AUTHENTICATING/READY/UNHEALTHY/STOPPING/STOPPED/FENCED）与 ST 向量一致 | [ROADMAP-01] §17.2、[CONTRACT-01] ST-01～ST-14 |
| 进程守护可用 | supervisor 按退避 spawn/重启 Harness；崩溃→N+1 generation；SIGTERM/stop 收敛 STOPPED；不复活旧 generation | [ROADMAP-01] §17.2、[CONTRACT-01] ST-05/06/13/14 |
| 单写保障 | 同一 volume 双 dshd 时仅一个取得 writer guard；`WRITER_GUARD_HELD` 诚实上报 | [ROADMAP-01] §17.1.4、[CONTRACT-01] CF-01 |
| 认证引导可用 | 解析 ready URL（loopback authority）、launch-token→authority-bound cookie exchange、probe 通过才置 READY；`localhost`/非 exact authority 不通过 | [ROADMAP-01] §17.2、[CONTRACT-01] PX-01/02 |
| 首次身份置备可用 | 空白 volume 校验注入 node_id/token/advertise/central，原子写 identity（只生成 storage_id）；非法输入 fail-closed 不 spawn | [CONTRACT-01] ID-01/02 |
| runner 场景可执行 | ID/CF/ST 中属于 dshd 侧的场景在 runner 真实执行并输出 executed 证据；依赖中央/管理面的场景诚实保持 declared | [CONTRACT-01] §9、[ROADMAP-01] §17.2 |

**出口门禁（路线图原文，不可改写）：** “dshd 能可靠管理并连接真实 Harness；相关 runner 场景可执行。”

## 2. 整体工作方法

| 方法 | M2 落地方式 | 依据 |
| --- | --- | --- |
| 契约优先 | 以 [CONTRACT-01] ID/CF/ST 向量与 [OPENAPI-01] 为行为权威；实现先满足向量的“必须观察到的结果”，再补测试 | [ROADMAP-01] §17.1.2 |
| 模块边界先行 | 在 M1 已确立的模块/crate 划分内实现 `state`（coordinator）、`lifecycle`/`supervisor`、`identity`、`harness`（认证引导）、`config` 的真实逻辑；不新增第二套 DTO | [ROADMAP-01] §9、[CONTRACT-01] |
| 分层增量 | 按“identity→state coordinator→supervisor→ready/cookie/probe→crash recovery→runner 场景接线”逐层形成可验证能力；每层完成 cargo check/test 与对应场景再进下一层 | [ROADMAP-01] §17.1.2 |
| 真实 Harness 接入 | M2 出口必须管理并连接**冻结真实 Harness**（[FREEZE-01] 固定源码，Node 24 runtime）；fake Harness 继续用于异常注入对照 | [ROADMAP-01] §17.2、§17.1.2 |
| 单写实证 | 用同一 volume 启动双进程实测 writer guard 竞争（CF-01），不以代码审查代替运行证据 | [CONTRACT-01] CF-01 |
| 诚实证据边界 | runner 只把真实执行且断言通过的场景记为 executed；其余保持 declared；不以自检通过冒充向量执行 | [CONTRACT-01] CT-08、§9 |

## 3. 边界

| 范围内 | 范围外（归属） |
| --- | --- |
| 首次身份置备：注入值校验、storage_id 原子生成与持久化、identity fail-closed（ID-01/02） | 中央服务对 storage_id/lease 的绑定裁决与 reverse-ready 的**中央侧**行为（M6 起由 reference stub 执行） |
| 单写 writer guard（flock/等价）与 `WRITER_GUARD_HELD` 上报（CF-01） | 跨 task 的 single-attach volume 排他由部署层保证（[ROADMAP-01] §17.1.4），测试不得以 guard 冒充 |
| desired/observed 状态机、原子迁移、ST 场景中 dshd 侧全部行为（ST-01/03/04/05/06/07/08/10/11/12/13/14 的本地部分） | 中央 lease 心跳、STALE/FENCED 的**中央裁决**、SYNCING/ONLINE 对账（M6/M3 与 reference stub 协作）；M2 用 stub/注入模拟其输入 |
| supervisor：spawn/退避重启/generation 递增/crash recovery/SIGTERM 收敛 | 管理面 API（start/stop/restart 作为 operator 操作入口属 M3；M2 内部以文件/信号触发同语义路径） |
| ready URL 解析、launch-token→cookie exchange、probe、exact authority 校验（PX-01/02 的认证部分） | HTTP/WS 透明代理（M4/M5）、header 隔离与 payload 转发 |
| 真实 Harness 的启动、连接与探测（本容器内一个 active Harness） | 修改 Harness 源码、管理容器外 Harness、跨节点迁移（[ROADMAP-01] §17.1.3） |
| runner 对 ID/CF/ST dshd 侧场景的执行证据 | 其余向量组（PX/SR/CT/PV 与 CF-02/03/04 等依赖中央/管理面的完整执行，M3/M4/M5/M6） |

## 4. 约束

1. dshd 以 Rust 实现为单一原生 Linux 二进制；不导入 Harness 私有模块，只经 CLI/stdout/HTTP/WS 契约通信；容器内 Node.js 24 仅为 Harness 子进程运行时（[ROADMAP-01] §8.1）。M1 锁定的工具链（`rust-toolchain.toml` 1.89.0 + `Cargo.lock`）不得在 M2 内解冻。
2. Harness 基线只读：固定 `dsh-v0.1.2-alpha.1`（commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`）；工程布局不得写入 `dsh/`；在 VPS/CI 上运行真实 Harness 须按 [FREEZE-01] 的 lockfile 安装其依赖并保持只读快照（[FREEZE-01]、[ROADMAP-01] §9、§17.1.4）。
3. 契约唯一权威：OpenAPI 3.1 + 接口规范 + 66 行为向量；生成物与测试不得与之冲突；M2 引入的状态/错误语义必须能映射回向量要求（[OPENAPI-01]、[CONTRACT-01]）。
4. node identity/token 由部署控制面预置、secret 只读注入；Harness token/cookie 只驻内存且不得写入日志；launch token 不得出现在任何持久文件（[ROADMAP-01] §17.1.4）。
5. 低层网络栈（tokio + hyper 或等价）沿用 M1 选型结论；本阶段只消费其进程/HTTP client 最小面，不实现代理行为（[ROADMAP-01] §8.2）。
6. 状态持久化位于声明的 `/var/lib/dsh`（开发期等价目录）并具备原子写；desired 与 observed 持久化语义不得混用；本地 writer guard 不能替代部署层排他挂载（[ROADMAP-01] §17.1.4）。
7. 诚实边界：runner 场景执行不得以 ID 数量冒充行为通过；M2 出口只对 dshd 侧场景输出 executed 证据（[CONTRACT-01] §9、CT-08）。

## 5. 交付物

**产品能力（在 M1 骨架内实现的 dshd 真实逻辑）：**

1. `identity`：注入值校验、storage_id 原子生成与持久化、identity mismatch fail-closed（ID-01/02 dshd 侧）；
2. `state`（coordinator）：desired/observed 正交、原子持久化、单一状态机与 ST 向量 dshd 侧迁移；
3. `lifecycle`/`supervisor`：spawn/退避重启/generation 递增/crash recovery/停止收敛（ST-05/06/11/13/14 本地部分）；
4. 单写 writer guard（flock/等价）与 `WRITER_GUARD_HELD`（CF-01）；
5. `harness` 认证引导：ready URL 解析、launch-token→authority-bound cookie exchange、probe（PX-01/02 认证部分）；
6. 真实 Harness 运行接入：按冻结基线安装依赖并以只读快照方式启动固定 `dsh web`，完成 ready 连接。

**验收资产更新：**

7. fake Harness 扩展：覆盖 M2 需要的 ready/cookie/probe/崩溃注入 fixture（保持 M1 骨架的 loopback 与自检）；
8. reference stub：补充 M2 场景所需的中央侧输入模拟（STALE/FENCED/lease 裁决由 M6 全量实现，M2 仅按向量输入注入）；
9. 66-vector runner：ID/CF/ST 中 dshd 侧场景可执行并输出真实 executed 证据；其余保持 declared；
10. 能力覆盖报告工具：新增 ID/CF/ST 场景的证据位登记。

**证据：** 出口记录（M2 exit-record 骨架）、场景执行报告（reports/）、CI 流水线中新增的 M2 单元/集成测试与 runner 场景任务。

## 6. 验收标准与验收方法

**验收标准（出口门禁的可核查分解）：**

1. 干净检出后 CI 一次通过：构建、lint、typecheck、unit、contract 全绿（沿用 M1 五模式机械验收并扩展 M2 测试）；
2. 单写实证：同一 volume 启动两个 dshd，仅第一个取得 writer guard 并 spawn；第二个不上报 local/ready 且输出 `WRITER_GUARD_HELD`（CF-01 真实验证）；
3. 真实 Harness 接入：按冻结基线安装依赖后，dshd 能启动固定 Harness、解析 ready URL、完成 cookie exchange 与 probe，置 READY 并保持守护；Harness 崩溃后按退避重启并发布 N+1 generation（ST-05 真实验证）；
4. 状态机与持久化：desired/observed 正交；stop 后重启不自动 spawn（ST-06）；SIGTERM 有界收敛 STOPPED；desired 保留供恢复（ST-14）；
5. 认证引导：`localhost` 或非 exact authority 不得通过 probe/READY（PX-02 语义）；launch token 不出现在持久文件或日志；
6. identity fail-closed：非法 endpoint/node_id 输入在打开 listener 或 spawn 前退出，不覆盖 identity（ID-02）；
7. runner 场景：ID/CF/ST 中 dshd 侧场景真实执行，runner 输出相应 `executed` 计数与逐场景证据；其余场景如实 `declared`；总口径仍为 66 declared，M2 只增加已执行子集。

**验收方法：**

| 步骤 | 方法 |
| --- | --- |
| 1 | 干净环境完整执行一次 CI（含 M2 新增测试与 runner 场景任务） |
| 2 | 独立运行单写竞争实测（同一 volume 双进程）并留存机器输出 |
| 3 | 独立运行真实 Harness 启动→认证→probe→READY→崩溃恢复链路并留存日志 |
| 4 | 运行 runner 核对 ID/CF/ST 场景 executed 证据与 declared/executed 口径 |
| 5 | 对身份/状态/持久化执行反例注入（非法输入、desired 损坏、并发写）验证 fail-closed |
| 6 | 按路线图 §17.2 出口门禁逐条核对，形成 M2 出口记录，作为 M3 的稳定输入 |

## 7. 诚实边界

M2 通过只证明 dshd 的**进程管理与认证引导**能力可用并连接了真实 Harness，不证明：中央 lease/注册客户端（M6）、管理面 API 与操作幂等（M3）、HTTP/WS 透明代理（M4/M5）、`WUI-*` parity（M4/M5/M8）、目标环境 runtime 收敛（M7）。ID/CF/ST 中依赖中央裁决与 reference stub 完整行为的场景在 M6 前保持 declared；runner 总口径始终 `declared=66`，M2 只把真实执行的子集记为 executed。

# 参考文献

| 标记 | 来源 | 说明 |
| --- | --- | --- |
| [ROADMAP-01] | [dshd 总体方案与路线图](../../dshd-service-design.md) | 阶段定义、技术路线、依赖与工具链锁定规则 |
| [ARCH-01] | [后端节点 HLD](../../backend-node-hld.md) | 节点架构与 Docker 边界 |
| [MVP-01] | [MVP 冻结基线](../../mvp-baseline.md) | 最高目标与边界基线 |
| [CONTRACT-01] | [中央服务—dshd 一致性测试规范](../../contracts/central-dshd-conformance.md) | 66 个行为向量（ID/CF/ST 为本阶段范围） |
| [OPENAPI-01] | [OpenAPI 3.1 契约](../../contracts/central-dshd-openapi.yaml) | Registry/Management 机器 schema |
| [FREEZE-01] | [Harness 版本冻结基线](../../dsh/harness-version-baseline.md) | 固定 Harness 源码与工具链范围 |
| [ACCEPT-01] | [后端独立验收报告](../../acceptance/backend-independent-acceptance.md) | 设计验收结论与实现门槛 VG-01～VG-03 |
