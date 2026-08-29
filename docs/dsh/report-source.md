# DeepSeek Harness 首轮研究（内部来源稿）

- 文档性质：内部来源稿（informative），不定义分布式后端规范；正式 MVP 结论以冻结基线、HLD 和接口规范为准。
- 受众：准备理解、运行和后续改造 DeepSeek Harness 的技术人员
- 日期：2026-08-29（Asia/Shanghai）
- 研究对象：`deepseek-ai/deepseek-harness`，`master` 分支浅克隆
- 固定提交：`cd5ef8148158c3a752a658978873241fdf8e2bbc`
- 范围：定位、启动与组合、agent 主循环、会话、工具、LLM、运行表层、测试和安全边界
- 排除：未逐包审计全部 248 个 dsh 包；未安装依赖、构建或调用真实模型 API

## 直接结论

DeepSeek Harness 的核心不是一个写死的 ReAct 循环或单一 DeepSeek API 客户端，而是一个由 Cordis 驱动、以插件树组合的 agent runtime。CLI 只负责选择 profile；profile 依次叠加 bundle、用户 patch 和命令行 overlay；真正的 agent、LLM、工具、会话、持久化、权限和 UI 均由插件贡献。最关键的不变式是“模型可见即必须入日志”：每次请求都从事件溯源会话投影历史，因此重放、恢复、分叉、压缩和 UI 可以共享同一事实来源。

源码显示其工程基础相当完整：插件卸载可逆、工具执行有 pre/around/post 三段策略、会话写入做深冻结和 JSON 边界验证、运行表层共享同一 profile 启动路径，并有单元、逐文件 100% 覆盖门槛、真实 API、会话快照和浏览器快照等多层验证。另一方面，上游明确标注开发者预览、未来会有破坏性变更且尚未安全审计；同机沙箱不能作为不可信负载的唯一隔离。因此它适合研究、原型和受控环境，不应直接按生产级安全边界部署。

## 证据摘要

1. `README` 将项目定义为 “everything-is-a-plugin”，并标注 developer preview 与 breaking changes。
2. `docs/architecture.md` 明确不存在需要修改的特权核心；通过并列挂载插件扩展，注册随插件卸载而撤销。
3. CLI `apps/cli/src/bin.ts` 解析参数后动态加载 `profile-boot.ts`，所有支持的 Node 应用经 `dsh --profile` 启动。
4. `PROFILE_TEMPLATES` 显示 `web/headless/sdk/acp` 由 `dsh-base` 加应用 bundle 组成，`sdk-minimal` 是独立例外。
5. `ReactLoopAgent` 按 turn/step 写入事件，从 `Session.deriveMessages()` 生成请求历史，流式记录 chunk，再执行工具调用。
6. `ToolRuntime.execute()` 依次经过 `tools/pre-execute`、`tools/execute` 和 `tools/post-execute`，并将失败物化为结构化结果。
7. `Session` 是 append-only 事件日志；`append()` 校验、快照和冻结输入，`deriveMessages()` 从 surface 增量投影模型历史。
8. 测试政策包含 unit、逐文件 100% coverage、真实 API e2e、会话 snapshot 与 Web/ARIA snapshot。
9. 安全文档明确声明未安全审计，并建议最小权限、一次性 VM/容器和备份。

## 本地规模统计

统计对象为固定提交的跟踪文件，排除了未跟踪研究产物：

- 跟踪文件：8,953
- `@deepseek-ai/dsh-*` 包：248
- `packages/apps/python/native` 下主要源码文件（TS/TSX/Python/Rust/C/C++）：3,117
- 匹配主要测试命名的文件：847

这些数字由 `git ls-files` 与 `rg --files`/`rg -l` 在本地工作树统计，属于本次研究的派生数据。

## 重要限制和未决项

- 当前 PowerShell PATH 中没有 `node`，且 `dsh/node_modules` 不存在；`pnpm --version` 为 11.19.0，而仓库固定 `pnpm@11.7.0`。
- 本轮完成 Git 对象连通性和工作树清洁检查，但未运行 `pnpm install`、typecheck、build、unit、snapshot 或真实 API e2e。
- `dsh/` 已整理为无嵌套 `.git` 的冻结源码快照；来源 tag、commit、tree 与 lockfile 哈希保存在版本冻结基线中。
- 这是首轮架构研究，不是逐包安全审计、性能评测或生产就绪认证。

## Claim-to-source ledger

| 结论 | 来源 | 日期/版本 | URL / 访问说明 | 置信度 |
|---|---|---|---|---|
| 一切皆插件、Cordis 驱动 | README | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/README.md#L5-L13 | 高 |
| 无特权核心，注册可逆 | Architecture | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/docs/architecture.md#L7-L13 | 高 |
| profile/bundle 分层与内置模板 | `profile.ts` | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/boot/app-boot/src/profile.ts#L137-L156 | 高 |
| turn/step/LLM/tool 主链路 | `agent.ts` | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/agent-loop/src/agent.ts#L255-L433 | 高 |
| 工具三段策略管线 | `tools/index.ts` | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/tools/src/index.ts#L1341-L1776 | 高 |
| 事件溯源会话和历史投影 | `session/index.ts` | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/session/src/index.ts#L418-L765 | 高 |
| 默认 workspace-write 与审批 | base patch | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/bundle/base/cordis.patch.yml#L211-L247 | 高 |
| 多层测试政策 | Testing policy | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/docs/testing.md#L7-L15 | 高 |
| 开发预览、未审计和沙箱限制 | Safety | commit `cd5ef81` | https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/SAFETY.zh.md#L5-L21 | 高 |
| 规模统计 | 本地派生 | commit `cd5ef81` | `git ls-files` 与 `rg`，2026-08-29 执行 | 高 |

## 停止理由

架构定位、主要执行链路、运行表层、扩展边界、测试与安全均已有源码或一方文档直接证据；第二轮补证未发现实质冲突。继续泛读包 README 只会重复同一 capability-seam 模式，短期不会改变首轮结论。下一阶段应转向可运行基线和一个纵向功能切片，而不是继续横向枚举包。
