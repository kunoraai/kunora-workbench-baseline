# 图像生成与修订来源

工具：内置 ImageGen。未使用 API/CLI、Figma 或图像脚本修改图片。原图先经查看，再作为实际图片引用传入；生成结果复制到本目录，原始生成文件保留。

## 共用提示词约束

Edit the provided Kunora Workbench Chinese desktop UI. Preserve the existing blue-white visual system, whale logo, sidebar, title-only header and seven tabs. Match the original approximately 1488×1056 aspect ratio. Keep source fictional 2026-08-29 dates and TASK/JOB identities. Make targeted corrections, not a brand redesign. Single full frame, crisp readable Chinese, no clipping.

## 页面提示词要点（实际提示的摘要）

| 产物 | 引用原图 | 页面约束及最终修正 |
| --- | --- | --- |
| 02-associate-task.png | kunora-workbench-associate-task.png | 名称改为可选，空值占位“可稍后填写”；辅助说明“未填写名称不影响创建和初始化”。仓库、分支仍必填。 |
| 03-duplicate-branch.png | kunora-workbench-associate-task-duplicate-error.png | 名称可选且保留输入；保留已有任务入口，新增更换分支和重新关联说明。 |
| 05-initialization-failed.png | kunora-workbench-task-initialization-failed.png | 管理员修复授权→检查访问→重试；检查通过前重试禁用；连接标签区分节点连接。 |
| 06-basic-info.png | kunora-workbench-basic-info-v2.png | 四组定义完整度、两列六要素摘要、标准/方法分开、全文与里程碑入口；最终精确移除意外英文“helper”。 |
| 07-messages.png | kunora-workbench-messages-v2-codex-thread.png | 节点、作业只读，自动分配说明，当前任务消息目标、草稿保留及作业详情入口。 |
| 08-repository.png | kunora-workbench-repository.png | 仓库分支只读，版本与刷新列表语义；最终去除意外侧栏徽标并修正双栏布局说明。 |
| 09-jobs.png | kunora-workbench-jobs-v2.png | 无总量不显示百分比，改当前阶段，保留已用时，新增停止执行与不可撤销说明。 |
| 10-deliverables.png | kunora-workbench-deliverables-v3.png | 双状态列，草稿/生成中不可验收，版本绑定，打开完整预览代替旧缩略图。 |
| 13-edit-save-failed.png | 本轮 06 基本信息 | 主内容改定义编辑器，标准/方法独立输入，失败保留输入，重试保存；最终移除未经定义的字符计数。 |
| 14-milestone-detail.png | 本轮 06 基本信息 | M2 的独立六要素、方案、计划；资料 2/3 已完善，计划空态与返回入口。 |
| 15-acceptance-form.png | 本轮 10 成果 | 版本只读、通过/需修改未选、需修改时评语必填、提交禁用、记录人/时间/版本说明。 |

该文件用于追溯生成意图；实现的准确规则以 interaction-spec.md 为准，不以摘要或生成器补全的细节替代产品定义。
