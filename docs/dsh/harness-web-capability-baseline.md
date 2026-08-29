# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | Agent | 将固定 Harness 官方 Web UI 能力、dshd 补齐能力和 MVP 排除能力固化为可追踪、可机器校验的验收基线。 | 用户要求、[MVP-01][SOURCE-01][AUDIT-01][CONTRACT-01] |
| v1.1 | 2026-08-29 | Agent | 修正 dshd 补齐能力的 evidence 章节定位，并将本地 Markdown 文件与标题锚点同时纳入机器校验；能力集合和验收语义不变。 | 用户要求、[CONTRACT-01] |
| v1.2 | 2026-08-29 | Agent | 明确区分 Harness 已有 Web UI 能力的透明代理兼容责任、dshd 新增能力的开发责任和 MVP 排除项；范围语义不变。 | 用户确认、[MVP-01][CONTRACT-01] |
| v1.3 | 2026-08-29 | Agent | 正式冻结三类能力的开发归属和验收口径，并纳入机器契约门禁。 | 用户确认、[MVP-01][CONTRACT-01] |
| v1.4 | 2026-08-29 | Agent | 随工作区模块化整理更新机器清单和证据定位；能力集合、归属及验收语义不变。 | 用户要求、[CONTRACT-01] |

# DeepSeek Harness Web 能力冻结基线

## 1. 状态与用途

状态：**已冻结**  
冻结对象：DeepSeek Harness `dsh-v0.1.2-alpha.1`，commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`  
机器清单版本：`1.0.4`  
机器权威：[能力清单 YAML](../contracts/harness-web-capabilities.yaml)

本文件把“完整复刻当前官方 Web UI 后端能力”转换为稳定能力 ID 和二元验收规则。它不扩展 Harness 内部能力，不要求 dshd 解释业务 payload，也不把中央服务或前端实现纳入后端交付。[MVP-01][AUDIT-01]

**范围口径：** `WUI-*` 是固定 Harness 已有业务能力的**代理兼容与验收目标**，不是 dshd 需要重新开发的业务功能；dshd 在这些能力上的开发范围只有通用 HTTP/Fetch/WebSocket 透明代理及其兼容性保障。`DSHD-*` 才是需要在 dshd 中新增实现的节点能力；`OUT-*` 不开发、不代理承诺，也不计入 MVP 通过率。[MVP-01][AUDIT-01][CONTRACT-01]

**冻结声明：** 上述三类开发归属与验收口径自 v1.3 起正式冻结，并与机器清单 `scope_semantics.status=frozen` 共同构成后续设计、开发和验收的权威范围基线。不得把 `WUI-*` 转化为 dshd 业务重实现任务，不得把 `DSHD-*` 降为仅代理能力，也不得把 `OUT-*` 纳入 MVP；任何改变必须取得明确确认、提升基线与机器清单版本，并重新执行受影响的范围、契约和验收复核。未改变三类归属的实现细化不构成解冻。[MVP-01][CONTRACT-01]

## 2. 能力分类

| 分类 | ID 范围 | dshd 开发责任 | 验收含义 |
| --- | --- | --- | --- |
| Harness 已有 Web UI 能力兼容目标 | `WUI-001`～`WUI-021` | 不重新实现业务能力；只开发通用透明代理，并保证这些既有能力无损通过 | 每个 ID 同时具备 inventory contract 与 parity E2E 通过证据 |
| dshd 新增节点能力 | `DSHD-001`～`DSHD-004` | 在 dshd 中新增实现生命周期、节点状态、注册租约和日志输出 | 每个 ID 具备接口契约与端到端证据 |
| MVP 排除项 | `OUT-001`～`OUT-009` | 不开发，也不承诺代理兼容 | 只验证没有被误列为交付必需项，不要求实现 |

完整字段、能力描述、transport、实现阶段、验收方法和事实来源均由机器清单保存。每个 `evidence` 必须定位到 `docs/` 内实际存在的 Markdown 文件及标题锚点，并由契约验证器检查；Markdown 摘要不得另建一套能力集合。[CONTRACT-01]

## 3. 官方 Web UI 能力覆盖

| ID | 能力域 | 载体 | 路线阶段 |
| --- | --- | --- | --- |
| WUI-001～WUI-002 | Session 目录与操作 | Remote HTTP | M4 |
| WUI-003～WUI-006 | Queue、历史、事件和 control 实时投影 | Remote HTTP + Remote mux | M4/M5 |
| WUI-007～WUI-017 | 模型、设置、凭据、Workspace、Preset、Command、Goal、Subagent、引用、附件和反馈 | Remote HTTP，Workspace follow 同时使用 Remote mux | M4/M5 |
| WUI-018～WUI-019 | Approval 与 User Questions 双向 waterfall | Remote mux | M5 |
| WUI-020 | Plugin inventory 与 Web 动态 Cordis | Remote HTTP + Remote mux | M4/M5 |
| WUI-021 | Session ZIP export | Fetch `GET/HEAD` streaming | M4 |

上述能力来自固定源码事实审计；dshd 的责任是无损承载，不是重新实现这些业务能力。[SOURCE-01][AUDIT-01]

## 4. 验收闭包

M8 必须输出一份以能力 ID 为主键的覆盖报告。对每个 `WUI-*`，报告必须同时引用：

1. inventory contract 结果，证明固定 Harness surface 与 dshd 路由没有遗漏；
2. parity E2E 结果，证明请求、响应、stream、event 或 frame 行为可用；
3. 被验收的候选镜像 digest、Harness commit 和能力清单版本。

任一 `WUI-*` 缺失、未执行或失败，官方 Web UI parity 即失败；不得用少量演示流程、仅验证路径存在或仅运行 66 个节点一致性向量替代。`DSHD-*` 由 OpenAPI、中央服务—dshd 一致性规范和故障 E2E 验收。`OUT-*` 不进入实现通过率，但如果实现或文档把它提升为 MVP 必需能力，必须按范围变更处理。[MVP-01][CONTRACT-01][TEST-01]

## 5. 变更规则

Harness commit、官方 Web UI 使用的 Host API/Remote/事件/Fetch route 或能力分类发生变化时，必须提升本基线和机器清单版本，重新执行源码审计、inventory contract 与完整 parity E2E。只修改测试实现而不改变能力语义时，不需要解冻六要素，但仍必须保持能力 ID 覆盖连续。[SOURCE-01][TEST-01]

## 6. 参考文献

| 标记 | 来源 | 说明 |
| --- | --- | --- |
| [MVP-01] | [MVP 冻结基线](../mvp-baseline.md) | 官方 Web UI parity 目标与不改 Harness 边界 |
| [SOURCE-01] | [Harness 版本冻结基线](harness-version-baseline.md) | 固定 tag、commit、tree、lockfile 和工具链 |
| [AUDIT-01] | [Harness API 暴露审计](harness-api-exposure-audit.md) | 已暴露、部分暴露和未暴露能力事实 |
| [CONTRACT-01] | [机器能力清单](../contracts/harness-web-capabilities.yaml) | 稳定 ID、分类、transport、阶段和验收方法 |
| [TEST-01] | [中央服务—dshd 一致性测试规范](../contracts/central-dshd-conformance.md) | 节点协议行为与最终验收边界 |
