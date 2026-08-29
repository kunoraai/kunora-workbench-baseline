# DeepSeek Harness 首轮研究报告

> 文档性质：源码研究（informative），不定义分布式后端规范；正式 MVP 结论以冻结基线、HLD 和接口规范为准。  
> 研究快照：2026-08-29；上游 `master`；提交 `cd5ef8148158c3a752a658978873241fdf8e2bbc`；版本 `0.1.2-alpha.1`

## 一句话判断

DeepSeek Harness 更像一个“可组合的 agent 运行时”，而不是一个单体 agent 框架：启动器、模型、工具、会话、权限、持久化、Web UI、SDK 和 subagent 都由 Cordis 插件树组装，部署者通过 profile 与 patch 改变系统，而不是修改核心循环。[README](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/README.md#L5-L13)；[架构说明](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/docs/architecture.md#L7-L21)

## 仓库快照

| 项目 | 结果 |
|---|---|
| 源码位置 | `dsh/` |
| 分支 / 提交 | `master` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| 上游版本 | `0.1.2-alpha.1` |
| 技术栈 | TypeScript ESM monorepo；Node `^22.19 || >=24`；pnpm workspace；少量 Python SDK 与原生平台组件 |
| 规模 | 8,953 个跟踪文件；248 个 dsh 包；3,117 个主要源码文件；847 个主要测试文件 |
| 许可证 | MIT |
| 当前成熟度 | developer preview；明确会有破坏性变更 |

版本和运行时要求见[根 package.json](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/package.json#L2-L10)。规模数字是本地对固定提交的派生统计。

当前 `dsh/` 是从已核验 commit `cd5ef8148158c3a752a658978873241fdf8e2bbc` 整理出的冻结源码快照，目录内不保留 `.git`。后续构建和源码检查直接使用该目录；版本来源以冻结基线中的 tag、commit、tree 和 lockfile 哈希记录为准。

## 系统怎样启动

`dsh` CLI 只解析它拥有的参数，然后选择一个具名 profile。profile 不是硬编码应用，而是按顺序叠加 bundle patch、profile patch、home patch 和 `--patch` overlay，最后交给 Cordis Loader 挂载。内置 `web`、`headless`、`sdk`、`acp` 都是 `dsh-base + 对应应用 bundle`；`sdk-minimal` 是独立的最小树。[CLI 入口](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/apps/cli/src/bin.ts#L20-L46)；[profile 模板](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/boot/app-boot/src/profile.ts#L137-L156)

```text
dsh CLI
  -> 选择 profile
  -> 叠加 base bundle / app bundle / 用户 patch / CLI overlay
  -> Cordis Loader 挂载插件树
  -> Web | Headless | SDK JSON-RPC | ACP
```

这意味着定制的首选方式是新增插件、替换 provider 或加一层 patch。需要特别注意：patch 对目标行的 `config` 是整体替换，不是深度合并，覆盖时必须重述要保留的字段。[base bundle 说明](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/bundle/base/README.zh.md#L36-L47)

## Agent 的核心执行链

一次 turn 可包含多个 step；每个 step 只对应一次模型请求及其工具调用。真实实现按下面的顺序工作：

```text
Inbox 消息
  -> agent/pre-step：组装系统提示、工具 schema、上下文
  -> 记录 turn/start、step/start、user/message
  -> 从 Session 日志 deriveMessages()
  -> agent/request：解析 provider/model 和请求参数
  -> ctx.llm.stream()：持续记录 assistant/chunk
  -> 汇总并记录 assistant/message
  -> 工具调用：pre-execute -> execute -> post-execute
  -> 记录 tool/call、tool/result、step/end、turn/end
```

关键实现位于 [`ReactLoopAgent`](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/agent-loop/src/agent.ts#L226-L433)。它没有把策略都塞进 loop，而是把请求、工具和停止行为暴露为事件扩展点。

## 三个最重要的设计决策

### 1. 模型可见内容必须可从日志重建

`Session` 是 append-only 事件日志。`append()` 会对输入做无损 JSON 校验、快照和深冻结；`deriveMessages()` 不是读取临时聊天数组，而是从日志 surface 增量投影模型历史。[Session 实现](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/session/src/index.ts#L418-L765)

这让恢复、分叉、重放、压缩、遥测和 UI 共享同一事实来源，也是项目最有辨识度的架构特征。代价是：任何新增的模型可见输入都必须设计新的 session event 和投影规则，改动面会比普通聊天框架更大。

### 2. 能力以 Definition / Provider / Consumer 三角色切开

文件系统、shell、subprocess、sandbox、LLM、web、skill、subagent、workflow 等都遵循 capability seam。工具只依赖抽象服务，provider 可以从本地替换为 E2B、外部进程或其他实现，而不需要改模型侧工具。[能力图](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/docs/capability-seams.md)

这对研究最重要的启示是：先找到能力所属 seam，再研究它的定义、provider 和 consumer；不要按目录名逐文件漫游。

### 3. 工具执行是策略管线，不是直接函数调用

`ToolRuntime.execute()` 依次执行：参数快照与可见性判断、`tools/pre-execute`、审批和单调 guard、`tools/execute` 包装器与工具体、`tools/post-execute`、结果 schema 校验、内容投影和最终通知。[工具管线](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/tools/src/index.ts#L1341-L1776)

因此权限、超时、结果裁剪、附加上下文和 UI presentation 都可以横切工具而不污染每个工具实现。这是后续扩展或审计时的首要切入点。

## 主要运行面

| 表层 | 用途 | 特点 |
|---|---|---|
| Web | 多轮交互和 GUI | `dsh web`；live patch reload |
| Headless | 一次性任务、脚本和 CI | 打印最终答案后退出，不开端口 |
| SDK | 外部程序驱动完整 Harness | stdio 上的换行分隔 JSON-RPC；TypeScript/Python 客户端 |
| ACP | 自动化 agent client 协议 | stdio 应用，不面向普通交互 |
| sdk-minimal | 最小 SDK 运行时 | 不依赖 `dsh-base`，拥有完整独立配置树 |

Python SDK 并没有重写 agent 核心，而是启动匹配版本的 `dsh --profile sdk` 子进程并说同一套 JSON-RPC。[Python SDK](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/python/README.md)；[SDK 包组](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/sdk/README.md)

## DeepSeek 模型接入

直接适配器注册 `deepseek-official` provider，模型 id 直接透传，配置和凭据按请求解析；它支持 thinking/reasoning effort、流式 SSE、图片与 Files API 回退。项目同时允许并列挂载基于 `pi-ai` 的另一组 provider，不把系统锁死在一个模型适配器上。[DeepSeek adapter 说明](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/llm/llm-deepseek/README.md)

因此这个仓库虽然由 DeepSeek 发布，但架构研究重点应放在 provider registry 和请求生命周期，而不是只研究 DeepSeek HTTP 协议。

## 工程质量信号

仓库的验证策略明显高于普通早期项目：

- 单元测试强调错误路径、事件顺序、并发竞态和 HMR 卸载安全。
- CI 覆盖门槛是 `packages/*/*/src` 逐文件 100%，而不只是总体百分比。
- 真实 API e2e 在有 key 时验证真实模型；无 key 自动跳过。
- 会话快照从记录的 `session.jsonl` 重放已发布 profile，并比较持久化结果和工作区。
- Web 快照使用 Chromium，同时保留 session 驱动和 ARIA/UI 证据。

详见[测试政策](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/docs/testing.md#L7-L15)。这说明代码量虽然大，但架构不变式和回归证据是项目的一等公民。

## 风险与边界

1. **不是生产安全承诺。** 上游明确写明尚未安全审计，不得视为安全或生产可用软件。[安全说明](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/SAFETY.zh.md#L5-L13)
2. **同机沙箱不是强隔离。** 默认 base profile 使用 `workspace-write` 并在危险操作前询问，但它仍共享宿主内核和文件系统；最好在一次性 VM、容器或专用环境运行。[默认策略](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/bundle/base/cordis.patch.yml#L211-L247)
3. **兼容性暂不稳定。** 项目处于 developer preview，明确会出现 breaking changes；内部会话和 SQLite 格式也不承诺向后兼容。
4. **组合复杂度高。** 248 个包带来清晰分层，也带来较高认知成本；理解具体行为时必须同时查看 package README、bundle patch、事件图和测试。
5. **本轮尚未做运行验证。** 当前终端 PATH 中没有 `node`，`node_modules` 未安装；只完成了源码、Git 连通性和工作树检查，未运行 build/test 或真实 API。

## 建议的后续研究路线

1. **建立可运行基线**：准备仓库要求的 Node 与 pnpm 版本，安装依赖，执行 `typecheck` 与最小 unit smoke。
2. **观察真实组合树**：运行 `pnpm dsh --profile headless --dump-config` 和 `web --dump-config`，把最终插件树与 bundle patch 对照。
3. **纵向追一条任务**：用 mock/replay 跟踪 `CLI -> profile -> agent -> session -> LLM -> tool -> persistence`，记录关键事件序列。
4. **实现一个最小插件**：优先新增只读 model-facing tool，完整走过 Definition/Consumer、注册 effect、schema、presentation 和 snapshot 测试。
5. **研究持久化与恢复**：比较 JSONL 与 SQLite provider，验证 resume、fork、compaction 和 projection cache。
6. **安全专项**：分别验证 Windows ACL、Linux Landlock/bwrap、macOS Seatbelt 的实际能力与失败关闭行为；不要仅根据配置推断隔离强度。

首轮结论已经足以指导代码阅读：从 profile 组合开始，沿 agent loop 和 session log 向两侧展开，再按 capability seam 选择具体功能深入。这比按 248 个包横向扫目录更高效。
