# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | Agent | 冻结里程碑 M1「工程与验收基础」的六要素定义。本文件从属于路线图级冻结六要素，不改变任何上层冻结语义。 | 用户要求、[ROADMAP-01][CONTRACT-01] |

# 里程碑 M1「工程与验收基础」六要素

| 项目 | 内容 |
| --- | --- |
| 文档状态 | **已冻结**（v1.0） |
| 冻结日期 | 2026-08-29 |
| 所属路线图 | dshd MVP 开发路线图（[ROADMAP-01] §17，v1.3） |
| 阶段位置 | `M0 → M1 → M2 → M3 → {M4,M5,M6} → M7 → M8` 中的 M1；直接依赖 M0（已完成） |
| 实现技术栈 | Rust 单一原生二进制（[ROADMAP-01] §8.1，v1.3）；容器内 Node.js 24 仅为 Harness 子进程运行时 |

## 0. 定位与从属关系

本文件是路线图 §17.2 中 M1 行的六要素展开，从属于整条路线图的冻结六要素（[ROADMAP-01] §17.1，v1.0）：

1. M1 六要素不得扩大或改变路线图级六要素的目标、边界、约束、交付物和验收含义；
2. M1 的出口门禁以路线图 §17.2 原文为准：“产品工程与验收工具均可在 CI 启动；测试资产有独立版本和自检”；
3. 本文件自 v1.0 起冻结。任何改变六要素含义的修订，必须取得用户明确确认、提升本文件版本，并同步复验受影响的上层基线；不改变含义的实现细化不构成解冻。

## 1. 最终目标

为整条 dshd 路线图建立可持续演进的工程地基和验收工具地基，使 M2–M8 的全部实现与验收都有可运行载体。

| 目标 | 成功判据 | 依据 |
| --- | --- | --- |
| dshd 产品工程可运行 | Rust 工程在 CI 中完成构建、lint、typecheck、unit、contract 全流程 | [ROADMAP-01] §17.2 |
| 验收工具可执行 | fake Harness、中央 reference stub、66-vector runner、能力覆盖报告工具建立骨架并可运行 | [ROADMAP-01] §17.2、[CONTRACT-01] §9 |
| 契约驱动开发就绪 | OpenAPI 3.1 生成 Rust 类型、Draft 2020-12 运行时校验、drift gate 进入构建链 | [ROADMAP-01] §8.3 |
| 镜像早期收敛 | Docker skeleton 从本阶段起持续构建（dshd builder + Harness builder 双构建骨架） | [ROADMAP-01] §14.1 |
| 工具链锁定 | `rust-toolchain.toml` 固定具体 Rust 版本，首次版本号在本阶段出口门禁时记录；`Cargo.lock` 摘要进入发布清单 | [ROADMAP-01] §7、§14.3 |

**出口门禁（路线图原文，不可改写）：** “产品工程与验收工具均可在 CI 启动；测试资产有独立版本和自检。”

## 2. 整体工作方法

| 方法 | M1 落地方式 | 依据 |
| --- | --- | --- |
| 契约优先 | 先建立 OpenAPI 生成、schema 校验和测试骨架，再实现功能（功能属 M2+）；代码与测试不得另建与冻结契约冲突的第二套定义 | [ROADMAP-01] §17.1.2、§7 |
| 模块边界先行 | 源码按模块边界组织为 Rust 模块/crate（`config, identity, state, lifecycle, supervisor, harness, transport, proxy, central, operations, observability` 或等价 crate 划分）；测试分 `unit/contract/integration/e2e`，构成五层测试体系起点 | [ROADMAP-01] §9、§5 |
| 骨架先行、增量补齐 | M1 只建 runner/stub/覆盖工具骨架；66 个向量场景随 M2–M6 增量补齐，M7 完成并冻结，M8 只执行 | [ROADMAP-01] §16、[CONTRACT-01] §9 |
| 生成链先行验证 | OpenAPI→Rust 类型生成与 Draft 2020-12 校验链须在 M1 建立时先行验证；成熟度不足时以受控自定义生成器替代，正反例全部进入 contract CI | [ROADMAP-01] §16 |
| 诚实证据边界 | 骨架阶段向量一律报告 `declared=N, executed=0`，不以 ID 数量冒充行为通过 | [CONTRACT-01] CT-08 |
| 黑盒集成预备 | fake Harness 覆盖异常路径，为 M2+ 接入冻结真实 Harness 做准备 | [ROADMAP-01] §17.1.2 |

## 3. 边界

| 范围内 | 范围外（归属） |
| --- | --- |
| dshd Cargo workspace 骨架、`Cargo.lock`、`rust-toolchain.toml`、CI 配置 | dshd 业务功能：状态协调、进程守护、认证引导、HTTP/WS 代理、中央客户端（M2–M6） |
| OpenAPI→Rust 生成链 + Draft 2020-12 validator + 标准 Rust JCS 实现的引入与接线 | 真实中央服务实现（系统级联调对象） |
| Docker skeleton：双 builder 骨架（dshd builder 以固定 Rust 工具链编译原生二进制；Harness builder 按 pnpm/lockfile）→ runtime stage（Node.js、tini、flock、dshd 二进制、Harness 闭包、CA） | 镜像 runtime 收敛、non-root/只读 rootfs/healthcheck 完整化（M7） |
| fake Harness、reference stub、66-vector runner、能力覆盖报告工具的骨架 | 验收工具完成与版本冻结（M7）、最终验收执行（M8） |
| 契约验证器 `validate_contracts.py` 纳入 CI 持续运行 | `WUI-*` parity 证据产出（M4/M5 执行、M8 汇总） |
| 测试资产独立版本与自检机制 | 修改冻结的 `dsh/` 源码（禁止项） |

## 4. 约束

1. dshd 以 Rust 实现、编译为单一原生 Linux 二进制；不导入 Harness 私有模块，只经 CLI/stdout/HTTP/WS 契约通信；容器内 Node.js 24 仅为 Harness 子进程运行时（[ROADMAP-01] §8.1）。
2. `rust-toolchain.toml` 固定具体 Rust 版本（首版于 M1 出口记录并向后可追踪）；依赖闭包由 `Cargo.lock` 锁定，其摘要进入发布清单；运行镜像不含构建工具链（[ROADMAP-01] §7、§14.3）。
3. Harness 基线只读：固定 `dsh-v0.1.2-alpha.1`（commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`）；工程布局不得写入 `dsh/`（[FREEZE-01]、[ROADMAP-01] §9）。
4. 契约唯一权威：OpenAPI 3.1 + 接口规范 + 66 行为向量；生成物与测试不得与之冲突（[OPENAPI-01]、[CONTRACT-01]）。
5. RFC 8785 JCS 采用经过测试的标准 Rust 实现，不手写浮点与 Unicode canonicalization（[ROADMAP-01] §8.3）。
6. 低层网络栈（tokio + hyper 或等价）选型必须满足“不自动重试、不自动重定向、不完整缓冲 body、可控制 upgrade 与提交点”的行为约束；M1 完成选型验证，代理实现属 M4/M5（[ROADMAP-01] §8.2）。
7. 测试资产具备独立版本号与自检；M8 不得开发或改变验收语义（[CONTRACT-01] §9）。

## 5. 交付物

**工程资产：**

1. dshd Cargo workspace 骨架（§9 模块/crate 划分 + `unit/contract/integration/e2e` 测试分层）；
2. `rust-toolchain.toml`（固定版本）+ `Cargo.lock` + frozen 构建配置；
3. OpenAPI→Rust 类型生成链 + drift gate（含生成链验证结论，必要时为受控自定义生成器）；
4. CI 流水线（lint=clippy/rustfmt、typecheck=cargo check 等等价门禁 + unit/contract + 契约验证器）；
5. Docker 双 builder skeleton（可构建出含 dshd 二进制与 Node.js/tini/flock/Harness 闭包的最小可启动镜像）。

**验收资产（骨架形态，独立版本 + 自检）：**

6. fake Harness（可控异常注入的本地替身）；
7. 中央 reference stub（Registry server + Management/Proxy client 双向骨架）；
8. 66-vector runner（可枚举全部 66 个向量 ID，诚实输出 `executed=0`）；
9. 能力覆盖报告工具（以能力 ID 为主键，为 M8 的 `WUI-*` 双证据报告准备数据结构）。

## 6. 验收标准与验收方法

**验收标准（出口门禁的可核查分解）：**

1. 干净检出后 CI 一次通过：构建、lint、typecheck、unit、contract 全绿；
2. 生成链验证结论成立：OpenAPI 生成的 Rust 类型与冻结契约一致，人为制造 drift 时 gate 失败；
3. `validate_contracts.py` 在 CI 实际执行且 PASS（10 paths / 42 schemas / 66 向量 declared）；
4. Docker skeleton 构建出镜像且可启动到确定行为；
5. `rust-toolchain.toml` 固定的版本号已记录，`Cargo.lock` 摘要可生成并纳入发布清单机制；
6. 四类验收资产骨架各带版本号、自检通过；runner 列出全部 66 个 ID 并如实报告 `0 executed`；
7. `dsh/` 零改动（源码 diff 审查）；无与冻结契约冲突的第二套 DTO/错误定义。

**验收方法：**

| 步骤 | 方法 |
| --- | --- |
| 1 | 干净环境（新 clone、无本地缓存）完整执行一次 CI |
| 2 | 执行契约验证器并留存机器报告 |
| 3 | 各验收资产运行自检脚本，核对版本号与 66 向量清单 |
| 4 | 构建并启动 skeleton 镜像，记录确定行为 |
| 5 | `git diff` 审查 `dsh/` 无变更；核对工具链版本与 lockfile 摘要记录 |
| 6 | 按路线图 §17.2 出口门禁逐条核对，形成 M1 出口记录，作为 M2 的稳定输入 |

## 7. 诚实边界

M1 通过只证明 Rust 工程与验收工具地基可用，不证明任何 dshd 行为已实现或验收：66 个行为向量保持 `declared, 0 executed`；Rust 低层 HTTP/WS 栈的行为验证发生在 M4/M5 的故障注入与 PX 向量中；目标 ECS 环境与镜像 runtime 收敛验证属 M7/M8。

# 参考文献

| 标记 | 来源 | 说明 |
| --- | --- | --- |
| [ROADMAP-01] | [dshd 总体方案与路线图](../../dshd-service-design.md) | 阶段定义、技术路线、依赖与工具链锁定规则 |
| [ARCH-01] | [后端节点 HLD](../../backend-node-hld.md) | 节点架构与 Docker 边界 |
| [MVP-01] | [MVP 冻结基线](../../mvp-baseline.md) | 最高目标与边界基线 |
| [CONTRACT-01] | [中央服务—dshd 一致性测试规范](../../contracts/central-dshd-conformance.md) | 66 个行为向量与验收资产建设阶段 |
| [OPENAPI-01] | [OpenAPI 3.1 契约](../../contracts/central-dshd-openapi.yaml) | Registry/Management 机器 schema |
| [FREEZE-01] | [Harness 版本冻结基线](../../dsh/harness-version-baseline.md) | 固定 Harness 源码与工具链范围 |
| [ACCEPT-01] | [后端独立验收报告](../../acceptance/backend-independent-acceptance.md) | 设计验收结论与实现门槛 VG-01～VG-03 |
