# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | Remote Agent | 将 M1 总体方案分解为契约优先的任务 DAG、关键路径和出口门禁核对计划。 | `docs/milestones/m1/six-elements.md`、`docs/milestones/m1/overall-plan.md` |

# M1「工程与验收基础」详细计划

## 1. 执行原则与计划口径

本计划只实施 `docs/milestones/m1/six-elements.md` 冻结的九项骨架交付，不实施任何 dshd 运行行为。执行顺序固定为：先核验冻结输入并建立 OpenAPI 生成、Draft 2020-12 校验、drift gate、66 ID manifest 和验收资产版本/自检协议；再搭 Cargo 工程、CI 和 Docker skeleton；最后在干净环境按六要素第 6 节形成出口记录。任何任务都不得把清单声明当作行为执行，M1 runner 的最终口径必须是 `declared=66, executed=0`。

工作量为工程执行估算，不是日历承诺；合计约 30.0 人日。任务产出中的“D1～D9”对应六要素第 5 节九项交付物；“总章”对应 `docs/milestones/m1/overall-plan.md` 章节。

## 2. 任务清单

| 编号 | 名称 | 直接依赖 | 输入 | 产出映射 | 完成判据 | 人日 |
| --- | --- | --- | --- | --- | --- | ---: |
| T01 | 冻结输入与基线核验 | 无 | six-elements、总体设计、HLD、OpenAPI、conformance、Harness/MVP 基线 | 总章 1～2；D1～D9 共用 | 记录文件摘要、版本、10 paths/42 schemas/66 IDs；确认 `dsh/` 只读与范围外清单 | 1.0 |
| T02 | 契约样例与生成验收矩阵 | T01 | OpenAPI、CT-01～CT-12 | 总章 5；D3 | 列出 `$ref`、联合、required/nullable、错误 response 与正反例；每项有预期 | 1.5 |
| T03 | OpenAPI→Rust 候选链先行探针 | T02 | 生成验收矩阵、候选生成器 | 总章 5.1～5.2；D3 | 固定版本；生成 42 schema 类型并编译；记录支持/不支持，不手建第二套 DTO | 2.0 |
| T04 | Draft 2020-12 与 JCS 选型验证 | T02 | CT-06/07/10～14 fixtures | 总章 5；D3 | runtime validator 接受全部正例、拒绝全部反例；JCS 标准实现探针通过 | 1.5 |
| T05 | 受控生成器后备决策 | T03、T04 | 两份探针结论 | 总章 5.2；D3 | 成熟链满足即记录“不启用”；否则形成范围受控、确定性、fail-closed 后备实现及 golden tests | 1.0 |
| T06 | drift gate 与负向自测 | T05 | 冻结 OpenAPI、生成配置 | 总章 5.3；D3 | 干净生成零 diff；临时人为 drift 必然失败；临时修改不进入仓库 | 1.0 |
| T07 | 66-vector manifest | T01 | conformance 七组 ID | 总章 10；D8 | 精确枚举 4/4/14/13/13/15/3，共 66；无重无漏，全部 DECLARED | 1.0 |
| T08 | runner 版本、报告和自检骨架 | T07 | vector manifest | 总章 10；D8 | `--version`/`--self-test` 可运行；JSON/JUnit 如实输出 declared=66、executed=0 | 1.5 |
| T09 | 验收资产统一协议 | T01、T07 | 版本/自检要求 | 总章 8～11；D6～D9 | 固定 version、self-test、scenario、artifact schema、脱敏 transcript 约定 | 0.5 |
| T10 | fake Harness 骨架 | T09 | Harness 冻结启动/认证/HTTP/WS 契约 | 总章 8；D6 | ready URL、cookie、HTTP/WS fixture 接口可启动；故障场景清单完整；自检不计向量执行 | 2.0 |
| T11 | reference stub 双向骨架 | T09、T02 | 10 OpenAPI paths、Proxy 规范面 | 总章 9；D7 | Registry server 与 Management/Proxy client 路由齐全；未实现明确返回；版本/自检通过 | 2.0 |
| T12 | 能力覆盖报告骨架 | T09 | capability machine inventory | 总章 11；D9 | 以 WUI/DSHD/OUT ID 为键；双证据规则可校验；空报告不虚报覆盖 | 1.5 |
| T13 | Cargo workspace 与依赖方向 | T03、T07、T09 | §9 模块边界 | 总章 3；D1 | workspace/crate 可构建；模块边界齐全；产品与工具分离；无循环依赖 | 2.0 |
| T14 | 测试分层骨架 | T08、T10、T11、T12、T13 | 四类资产和 workspace | 总章 3.3；D1 | unit/contract/integration/e2e 均有明确入口；e2e 不伪执行行为 | 1.0 |
| T15 | Rust 工具链与依赖闭包锁定 | T13 | 可构建 workspace | 总章 4；D2 | 具体 Rust 版本、components/target 固定；Cargo.lock 提交；全部命令 `--locked` | 1.0 |
| T16 | 首次版本与发布摘要机制 | T15 | rustc/cargo 输出、Cargo.lock、Harness lock | 总章 4、13；D2 | 可重复生成 Rust 版本记录及 lock SHA-256；发布清单字段明确 | 0.5 |
| T17 | CI 契约与 Python job | T06、T08、T12 | validate_contracts.py、locked Python deps | 总章 6；D4 | CI 实际执行 validator 和 contract jobs；记录 PASS、10/42/66 declared | 1.0 |
| T18 | CI Rust 质量 jobs | T14、T15、T17 | workspace、toolchain | 总章 6；D4 | rustfmt、clippy -D warnings、check、unit、contract 分 job 且 `--locked` | 1.0 |
| T19 | Harness builder skeleton | T01 | dsh/ lock、Node 24、pnpm 11.7.0 | 总章 7；D5 | frozen install/build；不 clone、不浮动、不在 runtime 安装 | 1.0 |
| T20 | dshd builder 与 runtime skeleton | T15、T19 | Rust binary、Harness closure、runtime 边界 | 总章 7；D5 | 三阶段职责明确；runtime 含 Node/tini/flock/CA/二进制/闭包，不含构建链 | 1.5 |
| T21 | Docker 确定行为 smoke | T18、T20 | skeleton image | 总章 7；D5 | 干净构建成功；启动产生稳定退出码/输出或骨架 liveness；不声称 READY/代理 | 1.0 |
| T22 | 四类资产 CI 启动整合 | T10、T11、T12、T18 | 资产入口与 CI | 总章 6、8～11；D4、D6～D9 | 每项版本和 self-test 在 CI 执行；runner 仍 executed=0 | 1.0 |
| T23 | 干净检出一次通过演练 | T16、T17、T18、T21、T22 | 全部锁定输入 | 总章 6、13；D1～D9 | 新 clone/无缓存的一次 pipeline 必需 jobs 全绿；证据可追踪 | 1.0 |
| T24 | 冻结边界与冲突审查 | T23 | git diff、生成物、DTO、dsh/ | 总章 2、12；D1～D9 | `dsh/` 零改动；无第二套 DTO/错误；无业务实现/通过声明 | 0.5 |
| T25 | M1 出口记录与移交 | T24 | 六要素 7 条标准、6 步方法、全部机器报告 | 总章 13；D1～D9 | 门禁逐项签核；记录工具版本/摘要/未实现项；作为 M2 稳定输入 | 1.0 |

## 3. DAG 与关键路径

```text
T01
├─T02─┬─T03─┐
│     └─T04─┴─T05─T06───────────────┐
├─T07─T08──────────────┐             │
│    └─T09─┬─T10───────┼──────────┐  │
│          ├─T11───────┤          │  │
│          └─T12───────┘          │  │
├─T19────────────────────────T20─T21─┤
└────────T03─T13─T14─T15─T18────────┼─T23─T24─T25
                    └─T16────────────┤
T06＋T08＋T12────────T17─────────────┤
T10＋T11＋T12＋T18──────────────T22──┘
```

关键路径标记为：`T01 → T02 → T03/T04 → T05 → T06 → T13 → T14 → T15 → T18 → T20 → T21 → T23 → T24 → T25`。其中 T03 与 T04 可并行，但 T05 必须同时消费两者；T19 可在契约链旁路准备冻结 Harness builder；T10、T11、T12 可在统一资产协议 T09 后并行。任何并行不改变契约先于业务填充的原则：T13 只能消费已验证的类型链，不能先手写 DTO 再倒推生成。

## 4. 任务执行细则

### 4.1 契约优先门禁

T02～T06 是工程填充前置门。候选生成链必须证明 OpenAPI 3.1 的 10 paths 与 42 schemas 能生成和编译；Draft 2020-12 正反例必须实际执行；人为 drift 必须被 gate 拒绝。若生态不满足，T05 选择受控自定义生成器并记录原因，而不是降低 schema 语义或复制 DTO。T07～T12 同步先固定验收资产的 ID、版本、报告和自检语义，使后续业务实现只能填充既有 driver 扩展点。

### 4.2 工程填充门禁

T13 后只建立 module/crate/trait/entrypoint 骨架。config、identity、state、lifecycle、supervisor、harness、transport、proxy、central、operations、observability 均可有编译占位，但不得实现 M2+ 状态机、进程、代理或 lease 行为。所有验收资产的正常启动只证明工具可执行；任何 NOT_IMPLEMENTED 是可接受且必须显式的 M1 结果。

### 4.3 证据命名与保存

每份机器证据包含：产生任务、UTC 时间、git commit、工具语义版本、输入摘要、环境版本、退出码和原始 artifact 路径。建议出口索引以 `Txx/check-name` 为稳定键。报告生成失败时不得人工补写 PASS；修复后重新从干净检出执行受影响 job，T23 必须仍是单次完整通过。

## 5. 九项交付物完成矩阵

| 六要素交付物 | 主任务 | 汇合任务 | M1 完成定义 |
| --- | --- | --- | --- |
| D1 Cargo workspace | T13、T14 | T18、T23 | 可构建、边界与四层测试入口明确 |
| D2 工具链锁定 | T15、T16 | T23 | 具体 Rust 版本、Cargo.lock、摘要机制 |
| D3 OpenAPI 生成/drift | T02～T06 | T17、T23 | 生成结论、runtime 正反例、drift 正负证明 |
| D4 CI | T17、T18、T22 | T23 | lint/typecheck/unit/contract/validator 一次全绿 |
| D5 Docker skeleton | T19～T21 | T23 | 双 builder + runtime，可启动到确定行为 |
| D6 fake Harness | T09、T10 | T22 | 版本、自检、故障注入接口可运行 |
| D7 reference stub | T09、T11 | T22 | Registry server + Management/Proxy client 骨架 |
| D8 runner | T07、T08 | T17、T22 | 66 ID 精确，declared=66/executed=0 |
| D9 能力覆盖 | T09、T12 | T17、T22 | capability ID 主键和双证据空报告骨架 |

## 6. 出口门禁核对计划

### 6.1 七条验收标准映射

| 六要素 §6 验收标准 | 任务/检查项 | 必须保存的出口记录 |
| --- | --- | --- |
| 1. 干净检出后 CI 一次通过 | T17、T18、T22、T23；检查 build/lint/typecheck/unit/contract 全绿 | 单次 pipeline URL/ID、job 状态、commit、无缓存环境说明 |
| 2. 生成链结论成立且 drift 可失败 | T02～T06、T17；检查零 drift 与临时 drift 负测 | 选型报告、生成摘要、正向 diff、负测失败输出 |
| 3. `validate_contracts.py` 在 CI PASS（10/42/66） | T01、T17、T23；检查实际调用仓库脚本 | 原始 validator 日志和机器报告，明确 66 是 declared |
| 4. Docker skeleton 可构建并启动到确定行为 | T19～T21、T23；检查镜像内容和 smoke oracle | build log、image ID、启动命令、退出码/响应和 runtime inventory |
| 5. Rust 版本记录与 Cargo.lock 摘要机制 | T15、T16、T23；检查具体版本和 `--locked` | `rustc -Vv`、cargo 版本、toolchain/lock SHA-256、manifest 片段 |
| 6. 四类验收资产有版本/自检；runner 66/0 | T08～T12、T22；检查所有 self-test | 四份 version 输出、自检报告、分组计数、declared=66/executed=0 |
| 7. `dsh/` 零改动且无第二套契约 | T24；检查 baseline..HEAD 和生成依赖方向 | path diff、DTO/错误定义审查表、冲突扫描结论 |

### 6.2 六步验收方法映射

| 六要素 §6 验收步骤 | 执行任务 | 操作与判定 |
| --- | --- | --- |
| 1. 新 clone、无缓存执行完整 CI | T23 | 只用锁定输入运行所有 required jobs；同一次 run 全绿才通过 |
| 2. 执行契约验证器并留机器报告 | T17、T23 | 调用现有 `validate_contracts.py`；保存退出码、10/42/66 输出 |
| 3. 资产自检并核对版本/66 清单 | T22 | 逐一运行 fake/stub/runner/report `--version`、`--self-test` |
| 4. 构建启动 skeleton 镜像 | T21、T23 | 保存构建和启动 oracle；只声明骨架确定行为 |
| 5. 审查 dsh/、工具链与 lock 摘要 | T16、T24 | git diff 为零；核对 Rust 版本、Cargo.lock 与 Harness lock 摘要 |
| 6. 按路线图出口逐条形成记录 | T25 | 汇总七项标准、偏差、风险、未实现项与 M2 输入，全部签核 |

## 7. M1 出口记录形成方式

T25 创建一份不可歧义的出口索引，而不是重新解释六要素。索引头记录 M1 commit、CI run、Rust/tool versions、OpenAPI SHA-256、Cargo.lock SHA-256、Harness tag/commit/tree/lock SHA-256、四类工具版本和 Docker smoke image ID；主体按 AC-01～AC-07 引用第 6.1 节七项证据，再按 VM-01～VM-06 引用第 6.2 节六步执行记录。每个条目只能是 PASS/FAIL/BLOCKED，并附原始 artifact；缺失证据不得记 PASS。

出口记录必须显式写明以下诚实声明：M1 未实现或验收任何 dshd 业务行为；66-vector runner 仅完成清单与运行框架，结果为 `declared=66, executed=0`；fake Harness 与 reference stub 的自检不等于产品行为通过；能力覆盖工具未产生 `WUI-*` parity 双证据；目标 ECS 和候选 digest 的冻结仍属 M7。该记录作为 M2 的稳定输入，M2 只能在既有 driver/模块扩展点增量实现。

## 8. 失败处理与回退

| 失败点 | 处理 | 禁止做法 |
| --- | --- | --- |
| 生成器丢失 schema 语义 | 执行 T05 后备并重跑 T03～T06 | 降级 Draft、手改生成物、复制 DTO |
| drift 负测不失败 | 阻断 T13/T17，修复比较输入/规范化 | 把负测标为可选 |
| Python 依赖不可重复 | 固定版本/哈希并从干净环境重试 | 依赖开发机全局包 |
| 资产自检把声明当执行 | 修正统计模型，所有结果回到 0 executed | 用 66 IDs 宣称 66 tests passed |
| Docker smoke 需要业务配置 | 收窄为版本/骨架模式的确定行为 | 虚构 READY、租约或 Harness 成功 |
| `dsh/` 或契约出现 diff | 立即阻断出口并撤销越界变更 | 修改冻结输入以配合实现 |
| T23 首次完整 run 失败 | 修复后产生新的完整 run，并如实保留失败记录；只有新的单次全绿可作为出口证据 | 拼接多次 job 结果冒充一次通过 |

## 9. M2～M8 移交检查

M2 接收 D1～D9 骨架和出口索引，填充 config/identity/state/supervisor/harness 以及 ID/CF/ST 基础 driver；M3 填充 management/operations 和相关 CT/ST；M4、M5、M6 在 M3 后分别填充 HTTP、WS、central driver，并持续累加真实 executed 数；M7 完成工具、runtime 和环境冻结；M8 仅对同一候选 digest 执行冻结 runner 与能力报告。任何阶段不得改变既有 ID 含义或回填虚假证据；需要改变验收语义时必须走冻结基线变更控制。
