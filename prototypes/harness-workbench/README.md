# Kunora Workbench

根据用户选定的第 3 张设计稿实现的独立前端原型。保留 Harness 的会话、工具记录、文件引用与输入操作概念，使用 Kunora 内网品牌；不是已接入 Harness 的插件，也未替换仓库内冻结的 `dsh/`。

## 打开

本地预览：<http://127.0.0.1:4173/>。

重新启动：在此目录执行 `npm ci`，然后 `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`。

构建：`npm run build`。打包验证：`npm run test:sites`。这些命令只生成本地文件，不发布。

## 可以操作

- 搜索、切换、新建会话；切换时保留每个会话的草稿。
- 新会话提供“梳理代码 / 完善界面 / 整理验收”三种起步建议，追加到草稿而不覆盖或自动发送。
- 会话历史支持按名称搜索、重命名、归档和恢复；归档不删除消息与草稿，运行中的会话不能归档。
- 顶部“会话操作”可重命名、创建独立副本、归档并撤销。副本保留消息与草稿，不是 Git 分支；运行中禁止复制和归档。
- “管理工作区”支持添加、切换与改名，保留各工作区的会话、草稿和归档关联；同名校验不区分大小写。这些只是示例分组，不连接目录。
- 顶部“会话文件”支持按名称/类型筛选、修改前后只读预览、打开现有文件对照、向草稿追加文件引用。无文件时提供明确空状态；手机分为列表和预览两步。
- 点击产出文件切换真实文本差异，展开或关闭详情。Escape 关闭并返回触发位置。
- 桌面并排对照；窄屏使用“修改前 / 修改后”标签，支持左右方向键。
- 输入、演示发送、排队、停止。停止时排队内容返回输入区。
- 设置分为通用、模型、插件与 Agent 预设。通用设置可调整字号和发送快捷键；开启“演示一次发送失败”可检查草稿恢复。
- Agent 预设新建独立会话并填入建议，保留原会话草稿。模型和插件页明确显示未接入状态，不收集密钥。
- 快捷指令、模式选择、字号、工作区分组与附件名称管理。

所有回复是明确标记的本地模拟，没有模型、API、Git、文件修改或上传。附件只保存名称，不读取内容。状态保存在当前页面内存，刷新会重置。标准/计划模式只改变演示反馈，不执行真实工作。

## 设计与代码

- 视觉目标：`../../docs/workbench/harness-redesign-2026-08-31/concepts/03-file-comparison.png`。
- 设计检查：[design-qa.md](design-qa.md)，选定范围内的视觉与交互检查 passed；不代表 Harness 全量功能覆盖。
- Harness UI 覆盖核查：[harness-ui-coverage.md](harness-ui-coverage.md)。2026-08-31 结论为未达到全量覆盖，含逐项来源映射、缺口优先级和本轮截图证据。
- 主要页面：`src/App.jsx`；样式：`src/Workbench.module.css`；语义色彩与字体：`src/styles.css`。
- 新会话、历史和设置：`src/WorkspaceSurfaces.jsx` 与 `src/WorkspaceSurfaces.module.css`。导航和浏览器标题统一为 `Kunora Workbench`。
- 工作区管理、会话菜单和文件浏览：`src/WorkbenchTools.jsx` 与 `src/WorkbenchTools.module.css`。
- 示例数据：`src/sample-data.js`；差异对齐：`src/diff.js`，使用 jsdiff 实际比较文本，不复制图片里的错误代码。
- 原始机械鲸鱼与文字标位于 `public/assets/brand/`，来自已固定版本的 Kunora 视觉仓库，未重新绘制。

字体与图标依据：[Manrope 字体来源](https://github.com/google/fonts/tree/main/ofl/manrope)、[Phosphor 官方 React 图标](https://github.com/phosphor-icons/react)。Manrope 从锁定 npm 依赖本地加载；MiSans 仅在设备已安装时使用，否则采用系统中文字体。详情见 [NOTICE.md](NOTICE.md)。

## 接入真实产品前

把本地模拟状态替换为 Harness 的正式 Session/Workspace 服务，将样式映射到其 `--dsw-alias-*` 与品牌槽位；不要并行创建另一份权威状态。需要验证模型授权、输入恢复、权限请求、文件访问边界、真实事件流及 Kunora Task/分支映射。不能把本原型的“产出文件”当作正式验收结果。

已完成浏览器交互、桌面/平板/手机布局、对比度和构建检查；没有进行真实模型调用、上传、原生文件选择器、屏幕阅读器或生产集成验收。
