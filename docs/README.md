# 文档目录

本目录保存 DeepSeek Harness 分布式后端节点项目的设计、契约和验收材料。冻结的 Harness 源码快照位于工作区根目录 `dsh/`，不包含嵌套 `.git`，不得在其中开发 dshd。

## 总体文档

- [MVP 冻结基线](mvp-baseline.md)
- [分布式可行性分析](distributed-harness-feasibility.md)
- [后端节点 HLD](backend-node-hld.md)
- [dshd 总体方案与路线图](dshd-service-design.md)
- [产品定义](kunora-workbench-product-definition.md)
- [工作台 UI/UX 文字大纲](workbench-ui-ux-outline.md)

## 模块文档

| 目录 | 内容 |
| --- | --- |
| [dsh/](dsh/) | Harness 源码审计、版本冻结、Web 能力冻结和事实来源 |
| [central-service/](central-service/) | 中央服务 HLD |
| [interfaces/](interfaces/) | 中央服务与 dshd 的接口规范 |
| [contracts/](contracts/) | OpenAPI、机器能力清单、一致性向量和契约验证器 |
| [reviews/](reviews/) | GAP 与设计复核材料 |
| [acceptance/](acceptance/) | 后端独立验收记录 |

总体目标、边界和路线图以本目录根部的冻结基线、后端节点 HLD 与 dshd 总体方案为准；模块文档不得自行扩大范围或改变冻结语义。
