# Harness UI × Kunora：提取与重设计

日期：2026-08-31。状态：用户已选第 3 张，独立交互原型位于 `../../../prototypes/harness-workbench/`。已通过本地设计与交互检查，尚未接入真实 Harness 模型或后端，未部署。

## 范围

以 DeepSeek Harness 的会话工作台为结构来源，以 KUNORA.internal Foundation 1.2 为视觉依据。此处是独立设计研究，不替换既有七标签业务草稿，不修改项目内冻结的 `dsh/`。Harness 的 Workspace / Session 仍保留原有含义；后续接入 Kunora Task 必须明确映射关系，不能只改名。

## 可追溯来源

| 来源 | 固定版本 | 用途 |
|---|---|---|
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness/tree/0a53fb55bea101816fa226bb964ae2bed71c343b) | master · `0a53fb55bea101816fa226bb964ae2bed71c343b` | Web 入口、客户端结构、组件行为 |
| [kunoraai/visual-design](https://github.com/kunoraai/visual-design/tree/7d196d9776cc0417c052f72dcc2df518a83413d0) | main · `7d196d9776cc0417c052f72dcc2df518a83413d0` | 内网规范、色彩、字体、机械鲸鱼与文字标 |
| 官方 npm `@deepseek-ai/dsh` | `0.1.2-alpha.2` | 原版界面截图；发布包不是上述 Git commit 的构建证明 |

源码工作副本位于工作目录下 `work/harness-redesign-sources/deepseek-harness/`；品牌工作副本位于同级 `visual-design/`。这些目录及运行状态已由局部忽略规则排除，避免意外提交嵌套仓库、安装包或认证状态。

## 实际提取

| 页面或区域 | 源码所有者 | 保留的交互含义 |
|---|---|---|
| Web 入口 | `apps/web/`、`packages/client/web/` | Vite 入口与插件启动；不是一张独立静态 HTML 即可运行 |
| 全局框架 | `packages/client/ui-layout/` | 侧栏 / 对话 / 详情三栏；详情可关闭、调整宽度 |
| 品牌与工作区 | `ui-brand-official/`、`ui-sidebar/`、`ui-workspace/` | 品牌槽位、工作区分组、会话检索、重命名、归档和分叉 |
| 对话与输入 | `ui-conversation/`、`ui-chat/`、`ui-trajectory/` | 连续会话、过程与结果、输入草稿、消息队列、停止 |
| 工具与文件 | `ui-tool/`、`ui-deliverables/` | 工具详情、成功修改工具产生的文件引用；不冒充验收通过 |
| 后台作业 | `ui-jobs/` | 会话可见作业只读列表；不是整个 Kunora 任务的进度条 |
| 人工介入 | `ui-approval/`、`ui-user-questions/` | 待处理请求暂时接管输入区；明确允许一次 / 拒绝 |
| 设置 | `ui-settings/`、`ui-settings-general/`、`ui-theme/` | 语言、外观、字号、权限、繁忙时回车行为 |

上表简称路径均相对于 `packages/client/`。具体入口和行为参考各包 README 与 `docs/subsystems/web-client.md`、`docs/web-styling.md`。

## 截图证据与边界

- [原版首页](references/harness-original-home.png)：实际本地官方发布包，未选择工作区、未连接模型。
- [原版设置](references/harness-original-settings.png)：实际中文通用设置，含权限、外观、字号和排队发送偏好。
- [测试版提示](references/harness-original-notice.png)：原版首次启动提示。
- [Kunora 品牌规范截图](references/kunora-brand-foundations.png)：来自上述品牌仓库。

本次仅在独立 `DSH_HOME` 中启动原版，跳过 API Key 配置，没有发送消息或执行工具。目录选择使用原生系统对话框，未完成该流程。会话、工具执行、文件内容的重设计画面使用明确标注的示例数据：依据源码行为构造，不是实际执行结果或已验证功能。未验证生产后端、移动端、键盘交互与模型执行。

## 视觉约束

- 内网使用机械鲸鱼，不能换成公共品牌的仿生鲸鱼。正式实现须直接使用保留的 SVG，不采用生成图中可能出现的近似描摹。
- 深蓝 `#073B9F` 为侧栏和主要按钮；交互蓝 `#1677FF` 主要用于焦点与短暂交互。
- Canvas `#F8FBFF`、白色 `#FFFFFF`、Ink `#061A3A`、Slate `#344563`、Muted `#687A96`；线条 `#DBE6F5`。
- 状态点：Mint `#36D399`、Cyan `#1ED7E6`、Amber `#FFB020`、Coral `#FF5A7A`。小字用较深语义色或正文色，不把这些浅亮色直接当小号文字；状态必须有文字或图标。
- 中文 MiSans；英文与数字 Manrope；正文 14–16px，辅助信息至少 12px。遵守字体许可，不随设计稿分发字体二进制。
- 桌面侧栏 260px、标题栏 72px，控件高 40px；控件圆角 8px，表面 12px；静态面板不加阴影。
- 移动端后续改为抽屉导航，控件至少 44px。不得以缩小文字适配窄屏。

## 不可丢失的行为

1. 空白、运行、排队、失败、等待授权均须不同展示。失败恢复草稿并保留新输入；不能只给一个短暂提示。
2. 运行时空输入的主要操作是停止；有新输入时对应排队发送。键盘行为遵循原设置，不用外观改版改变发送策略。
3. 作业只展示真实状态与耗时，不虚构百分比。进程重启可能清空作业列表，历史工具记录仍保留。
4. 原版产出文件来自成功的文件修改记录；不把“生成完成”自动转成 Kunora “验收通过”。
5. 工具详情关闭后返回触发位置；弹层支持 Escape、明确关闭按钮与焦点恢复。桌面详情是非模态，窄屏再切换合适容器。
6. 工作区、会话与 Kunora 仓库分支绑定不是同一实体；本阶段不增加任务分配、成员切换或仓库同步等无后端依据的按钮。

## 后续实现位置

采用 Harness 原有 CSS Modules 和 `--dsw-alias-*` 语义变量。通过 `ctx.theme` 注册 Kunora 覆盖层，品牌通过 sidebar 的 mark/name 槽位替换。布局调整属于 `ui-layout` 与对应局部组件，不能把 API 或业务状态复制到一个静态页面中。浅色稿选定后，再核对深色模式与全部交互状态。

示例映射：`--dsw-alias-brand-primary` → `#073B9F`；`--dsw-alias-bg-base` → `#F8FBFF`；各 raised layer → `#FFFFFF`；`--dsw-alias-border-l2` → `#DBE6F5`。这只是实施说明，尚未应用或通过对比度验证。侧栏需要独立深色表面与反白文字，不能仅修改全局主色。

## 三个视觉方向

编号严格对应本次聊天中三个新生成设计图的显示顺序，不包含前面的原版截图和品牌参考图。

| 编号 | 设计图 | 主次关系 |
|---|---|---|
| 1 | [对话优先](concepts/01-conversation-first.png) | 完整会话区，工具详情按需展开 |
| 2 | [执行详情常驻](concepts/02-execution-inspector.png) | 对话与较窄的工具详情并排 |
| 3 | [文件对照](concepts/03-file-comparison.png) | 扩大文件差异区域，保留可用对话区 |

三图独立生成；每次均附上原版首页、原版设置、Kunora 品牌板与正式机械鲸鱼栅格母版。生成目标为 1440×1024，三张实际输出均为 1487×1058，未进行拉伸或裁剪。原版截图核对完成后已停止本次临时 Harness 服务。

### 视觉核对及实现前必须修正的点

- 已检查三图的主布局、中文信息层级、输入区、主要状态与示例标识；它们用于选定方向，不作为精确像素或行为验收。
- 生成器没有严格保持 260px 侧栏、72px 标题栏或准确字号；实现时以规范中的数值为准。
- 第二张 assistant 头像未准确使用机械鲸鱼；正式实现统一替换为保留的 SVG 或中性的字母头像。不得沿用生成的近似品牌图案。
- 第二张出现的文件大小仅是生成器补充的示例，不是源文件属性；实现时读取真实数据或省略。
- 第三张代码有不应出现的额外括号，且差异行对齐只是示意；不得复制生成图里的代码。正式 diff 必须由真实工具事件和文本差异渲染。
- 个别区域仍偏卡片化；实现时优先合并为列表与细分隔线，减少边框。
- 全部按钮是图像；尚未验证键盘、焦点、窄屏、深色、对比度或后端状态。

用户已选择第 3 张，并指出三种方案差异较小。现按该选择实现独立原型，未继续生成近似选项。详情见 `../../../prototypes/harness-workbench/README.md` 与该目录下的 `design-qa.md`。本阶段不修改现有生产产品行为。

## 许可与保存

保留 [DeepSeek MIT 声明](references/DEEPSEEK-LICENSE.txt) 与 [Kunora / 字体 Notice](references/KUNORA-NOTICE.md)。Kunora 仓库未声明统一开源许可；此副本用于用户请求的 Kunora 内部设计，不表示取得对外再授权。重设计使用 Kunora 身份，不暗示 DeepSeek 官方出品或背书。

本软件使用 MiSans；MiSans 字体知识产权归小米科技有限责任公司所有。
