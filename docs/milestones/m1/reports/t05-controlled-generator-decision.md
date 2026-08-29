# T05 后备决策记录

决定：启用范围受控、确定性的 M1 生成边界，输入直接嵌入冻结 OpenAPI 并以确定性指纹驱动 drift gate。原因是 M1 不应以不完整生态生成物冒充完整契约 DTO。

约束：冻结 OpenAPI 是唯一权威；未知/变化输入由 drift 测试拒绝；不手改冻结契约；不建立业务 DTO；后续引入完整生成器前必须重新执行 T02–T06 矩阵。

实际证据：`cargo test -p dshd-contract --test drift_gate --locked` 的干净输入和隔离临时 drift 两项测试均通过。

