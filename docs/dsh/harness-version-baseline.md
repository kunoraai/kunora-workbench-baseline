# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | Agent | 冻结 dshd MVP 使用的原生 DeepSeek Harness 源码、依赖锁和 Node.js/pnpm 工具链基线，并定义升级门禁。 | 用户要求、[SRC-01][SRC-02][ARCH-01][ACCEPT-01] |
| v1.1 | 2026-08-29 | Agent | 将固定源码版本与 `WUI-*` Web 能力机器清单建立一一对应的升级和验收关系。 | 用户要求、[CAPABILITY-01][ARCH-01][ACCEPT-01] |
| v1.2 | 2026-08-29 | Agent | 将冻结源码整理为无嵌套 Git 的 `dsh/` 快照，并更新本地校验方式和文档路径；冻结内容不变。 | 用户要求、[SRC-01][SRC-02] |

# DeepSeek Harness MVP 版本冻结基线

## 1. 冻结结论

dshd MVP 固定使用 DeepSeek Harness `dsh-v0.1.2-alpha.1`，commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`。dshd 不修改该源码的存储、Agent runtime、Session 模型或业务 API；Harness 作为只读构建输入和容器内受管子进程使用。[ARCH-01][ARCH-02]

| 项目 | 冻结值 | 验证方式 |
| --- | --- | --- |
| 来源 Git tag | `dsh-v0.1.2-alpha.1` | 移除嵌套 Git 前记录；与发布清单核对 |
| 来源 Git commit | `cd5ef8148158c3a752a658978873241fdf8e2bbc` | 移除嵌套 Git 前记录；与发布清单核对 |
| 来源 Git tree | `a712eec535b48badc4fefb4df5176a7002e4280b` | 移除嵌套 Git 前记录；升级时在新来源仓库复验 |
| `pnpm-lock.yaml` SHA-256 | `506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1` | `Get-FileHash dsh/pnpm-lock.yaml -Algorithm SHA256` |
| Node.js | `24.x` | 镜像构建和 CI 固定 major/minor/patch 或 image digest |
| pnpm | `11.7.0` | 根 `package.json#packageManager` |
| Harness package version | `0.1.2-alpha.1` | 根 `package.json#version` |
| 运行 profile | 原生 `dsh web --no-open --port 0` | dshd 启动契约与集成测试 |

Node.js 24 是本项目容器工具链选择；原生仓库声明兼容 `^22.19.0 || >=24.0.0`，官方 CI 主要使用 Node 24。依赖安装必须使用冻结 lockfile，不允许在容器运行阶段下载代码或解析浮动版本。[SRC-02][ARCH-01]

## 2. 冻结范围

冻结内容包括：

- Harness Git commit/tree、tag 和 package version；
- `pnpm-lock.yaml` 及由其解析的依赖闭包；
- Node.js 24 与 pnpm 11.7.0 构建工具链；
- dshd 依赖的动态端口、ready URL、authority-bound cookie、HTTP `/api/**`、WebSocket `/api/remote.mux`、Session create/fork 和 export 行为基线；
- 与该源码版本对应的 [Web 能力冻结基线](harness-web-capability-baseline.md)和 `WUI-*` 机器清单；
- dshd 与 Harness 的成对兼容关系。

暂未冻结最终 Docker image digest，因为镜像尚未实现。第一次可重复构建通过后，必须把基础镜像 digest、Harness 构建产物 digest 和最终节点镜像 digest 写入发布清单，届时 digest 成为部署权威值。[ARCH-01][ACCEPT-01]

## 3. 源码与交付边界

`dsh/` 是不含 `.git` 的固定源码快照，保持只读，不在其中开发 dshd。项目以已记录 commit/tree/tag、lockfile 哈希和发布清单证明其来源；Docker 多阶段构建只消费该固定输入。禁止在 Docker build 中无校验地 clone 分支、tag 浮动引用或 `latest`，禁止在容器启动时执行 `npx`/`pnpm install`。[ARCH-01]

dshd 是项目自有实现，独立拥有源代码、测试、Dockerfile 和发布版本。dshd 版本与 Harness 基线通过兼容矩阵成对发布，例如 `dshd 0.1.x ↔ Harness dsh-v0.1.2-alpha.1`；不得单独替换容器内 Harness 而不重新执行兼容验收。[ARCH-01][CONTRACT-01]

## 4. 版本升级门禁

任何 Harness commit、tag、lockfile、Node major 或关键 Web API 行为变化都必须建立新的冻结基线，不能覆盖本记录。升级至少需要：

1. 重新执行源码事实审计，核对启动、认证、HTTP/WS、Session 和 export surface；
2. 重新执行 OpenAPI/文档契约验证器；
3. 执行 66 个中央服务—dshd 行为向量；
4. 执行官方 Web UI parity E2E；
5. 在目标 ECS/Docker 环境重新验证 sandbox、volume、非 root 和只读 rootfs；
6. 生成新的构建产物和镜像 digest，并更新 dshd/Harness 兼容矩阵；
7. 通过独立验收后才允许发布。[CONTRACT-01][ACCEPT-01]

## 5. 参考文献

| 标记 | 来源 | 说明 |
| --- | --- | --- |
| [SRC-01] | 本地固定源码 `dsh/` | Git commit、tag、tree 和行为事实来源 |
| [SRC-02] | [Harness package.json](../../dsh/package.json) 与 [pnpm-lock.yaml](../../dsh/pnpm-lock.yaml) | 版本、Node engines、pnpm 和依赖锁 |
| [ARCH-01] | [后端节点 HLD](../backend-node-hld.md) | 单镜像、固定版本、Node/Harness 运行和发布边界 |
| [ARCH-02] | [MVP 冻结基线](../mvp-baseline.md) | 不改 Harness 和外围管理目标 |
| [CONTRACT-01] | [中央服务—dshd 一致性测试规范](../contracts/central-dshd-conformance.md) | 66 个行为向量与通过规则 |
| [ACCEPT-01] | [后端独立验收报告](../acceptance/backend-independent-acceptance.md) | 设计验收结论与实现验收门槛 |
| [CAPABILITY-01] | [Web 能力冻结基线](harness-web-capability-baseline.md)与[机器能力清单](../contracts/harness-web-capabilities.yaml) | 固定 Harness 源码对应的官方 Web UI 能力集合与逐项验收规则 |
