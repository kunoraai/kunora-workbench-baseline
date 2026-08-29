# T02 生成验收矩阵

| 特性 | 正例预期 | 反例预期 | M1 门禁 |
| --- | --- | --- | --- |
| `$ref` | 本地 component 可解析 | 未知引用失败 | fail closed |
| `oneOf`/判别联合 | 唯一分支匹配 | 零或多分支拒绝 | Draft 2020-12 |
| required/nullable | required 齐全且显式 null 仅按 schema | 缺 required/非法 null 拒绝 | runtime probe |
| additionalProperties | 按 schema 接受 | 禁止时拒绝未知字段 | runtime probe |
| status error schema | 状态码对应错误类型 | 错误响应错配拒绝 | contract test |
| JCS | 标准实现确定性 canonical bytes | 非法 JSON/数值拒绝 | 不手写 canonicalization |

该矩阵不创建第二套 DTO；冻结 OpenAPI 始终是唯一输入。

