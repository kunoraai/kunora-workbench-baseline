# M1「工程与验收基础」第二轮独立验收报告（R2）

## 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| R2 | 2026-08-29 | Remote Agent | 独立核验迭代 2 对 R1 F01～F12 的处置，复审冻结文档、增量代码并真实复跑规定门禁。 | `six-elements.md`、`overall-plan.md`、`detailed-plan.md`、R1 报告、当前代码及本机输出 |

## 1. 总体结论

总体结论：未通过独立验收

迭代 2 的机械基础较 R1 有显著改善，真实 drift 负向门、66 项 manifest、34 项 inventory、loopback 自检、CI job 拆分和 target 锁定均已落地；但核心生成链仍把全部 42 个 OpenAPI schema 生成为互不区分的 `serde_json::Value` 透明包装，未生成与 schema 字段、枚举、联合及约束相对应的强类型 DTO。reference stub 也只真实覆盖 3 个 Registry 请求却报告 `routes=13`，capability inventory 校验未 fail-closed 拒绝未知 ID。因此维度一为 FAIL、维度二为 FAIL、维度三为 FAIL、维度四为 PASS；AC-01/VM-01 依指定环境事实记 `BLOCKED-EXTERNAL`，不作为实现缺陷。

| 维度 | 结论 | 理由 |
| --- | --- | --- |
| 阶段目标达成 | FAIL | AC-02 的“42 schema 类型生成并编译”仍未达到冻结语义；AC-06 的部分资产自检存在过度声明。 |
| 交付物与计划符合度 | FAIL | F01 仅 PARTIAL，F07、F08 仍为 PARTIAL；核心 D3、D7、D9 不能签核。 |
| 代码评审 | FAIL | 生成类型全部退化为任意 JSON；stub 路由计数与实际执行不一致；inventory 未精确约束 ID 集。 |
| 真实测试复跑 | PASS | 所有规定本地命令均真实 exit 0，负向门也确实拒绝损毁副本；通过仅证明现有门禁，不覆盖上述语义缺口。 |

## 2. 阶段目标达成：AC/VM 重估

### 2.1 AC-01～AC-07

| 标准 | 状态 | 独立证据与判断 |
| --- | --- | --- |
| AC-01 干净检出 CI 一次通过 | BLOCKED-EXTERNAL | GitHub Actions 因账户计费全部 startup_failure，依冻结口径不计实现缺陷。静态审查 `.github/workflows/m1.yml`：`contracts-source`、`contract-generate`、`fmt`、`clippy`、`check`、`test`、`contract-assets`、`docker-smoke` 为独立 job；Cargo 命令使用 `--locked`，validator 与 contract-gen 均调用仓库真实入口。 |
| AC-02 生成链与人为 drift | FAIL | `contract-gen --check/--regen` 与损毁生成物负测真实有效，但 `types.rs` 的 42 项全部为透明 `serde_json::Value`，没有 schema 字段/枚举/联合映射，未满足 T03“生成并编译 42 schema 类型”。 |
| AC-03 CI 执行契约验证器 | PASS（本地与静态） | workflow 调用 `python docs/contracts/validate_contracts.py`；独立临时 venv 复跑得到 10 paths、42 schemas、66 declared、0 executed。远端日志受 AC-01 外阻。 |
| AC-04 Docker skeleton | PENDING | Dockerfile 已改为 builder 验证 `/harness-closure` 且 runtime 仅复制 closure；本机没有 Docker、远端 CI 外阻，不能声称 build/smoke PASS。 |
| AC-05 工具链与 lock | PASS | `rust-toolchain.toml` 固定 Rust 1.89.0、rustfmt/clippy 与 `x86_64-unknown-linux-gnu`；Cargo.lock 包含实际依赖闭包。 |
| AC-06 四资产版本、自检、66/0 | CONCERNS | 四资产 0.2.0 的 version/self-test 均通过，runner 真实输出 `declared=66 executed=0`；但 stub 的 routes=13 与实际 3 条成功路由不一致，capability ID 集未精确 fail-closed。 |
| AC-07 冻结边界 | PASS | `c42ba1f..a4116af` 增量中 `dsh/` 与 `docs/contracts/` 零改动；未发现第二套业务 DTO，未实现行为显式标记 `NOT_IMPLEMENTED`。 |

### 2.2 VM-01～VM-06

| 方法 | 状态 | 说明 |
| --- | --- | --- |
| VM-01 新 clone、无缓存完整 CI | BLOCKED-EXTERNAL | 计费 startup_failure 导致同一次远端 run 无法形成，不计实现缺陷。 |
| VM-02 契约验证器与机器报告 | PASS（本地） | 临时 Python 3.12 venv 按锁定 requirements 安装后 validator exit 0，完整输出包含 10/42/66。 |
| VM-03 四资产版本、自检、清单 | CONCERNS | 入口与负向损毁门均可运行，但 stub 与 capability 的语义缺口使其不能完全签核。 |
| VM-04 构建并启动 skeleton 镜像 | PENDING | 本机无 Docker，CI 外部阻断；静态结构改善但没有真实镜像证据。 |
| VM-05 diff、工具链、摘要 | PASS | 冻结目录零 diff，target 与 lock 均固定；当前工作树复跑后只有未跟踪 `PROMPT.md`。 |
| VM-06 出口记录 | PASS（诚实性） | `exit-record.md` 的 AC-02 引用真实 `contract-gen --check`/损毁门，远端 CI 与 Docker 保持 PENDING，未把 66 declared 冒充 executed。 |

### 2.3 T01～T25 判据复核

| 任务 | 状态 | R2 判断 |
| --- | --- | --- |
| T01 | PASS | 冻结摘要与 10/42/66 基线可复核。 |
| T02 | PASS | 生成验收矩阵覆盖 `$ref`、联合、nullable、错误与 JCS 正反预期。 |
| T03 | FAIL | 42 个命名包装存在，但并非 schema 对应强类型 DTO。 |
| T04 | CONCERNS | Cargo.lock 有 `jsonschema` 与 `acdp-jcs`，正反测试调用真实库；fixtures 仅为小型探针，未系统覆盖冻结 schema。 |
| T05 | CONCERNS | 生成器确定且顶层未知关键字 fail-closed，但生成语义不足。 |
| T06 | PASS | clean check、损毁生成物非零、恢复再 check 均真实成立。 |
| T07 | PASS | CSV 精确逐行 66 ID，分组 4/4/14/13/13/15/3，含 spec_ref/driver/status/evidence 列。 |
| T08 | PASS | runner 从 manifest 加载，损毁副本失败，text/JSON/JUnit 同为 declared=66、executed=0。 |
| T09 | PASS | 四资产统一 version/self-test/显式 NOT_IMPLEMENTED 口径已形成。 |
| T10 | PASS（M1 骨架） | fake 自检真实 bind+probe，检查 token/cookie/authority、HTTP 拒绝与异常字符串；WS 显式 NOT_IMPLEMENTED。 |
| T11 | FAIL | Registry client 真实调用 register/heartbeat/deregister，但 Management/Proxy 等其余路由没有实现，`routes=13` 是常量文字。 |
| T12 | CONCERNS | inventory 为 34 项且 JSON/Markdown 同源、WUI 双证据成对规则存在；未知 ID 未被精确集合拒绝。 |
| T13 | PASS | workspace 新增 crate 后可构建，依赖方向未见环。 |
| T14 | CONCERNS | unit/contract 入口可执行，integration/e2e 仍以骨架边界为主。 |
| T15 | PASS | Rust 版本、components、target、Cargo.lock 与 `--locked` 均落地。 |
| T16 | PASS | 版本与 lock 摘要机制仍可用，出口记录列出摘要。 |
| T17 | PASS（定义） | CI 有真实 validator 与 contract-generate/drift job；远端执行受外阻。 |
| T18 | PASS（定义） | fmt、clippy、check、test 已分 job，Cargo 命令按适用处使用 `--locked`。 |
| T19 | PENDING | frozen Harness install/build 已定义，缺真实 Docker build 证据。 |
| T20 | CONCERNS | 三阶段与 runtime closure 已收窄；实际 closure 完备性待 Docker 证明。 |
| T21 | PENDING | smoke 定义存在，但本机/远端均没有成功执行证据。 |
| T22 | CONCERNS | CI 同时跑四资产 version/self-test；stub/capability 自检语义仍不足。 |
| T23 | BLOCKED-EXTERNAL | 新 clone 同次 pipeline 因外部计费不能执行。 |
| T24 | PASS | `dsh/`、冻结契约零修改，无第二套业务 DTO，未实现项显式。 |
| T25 | CONCERNS | 出口索引诚实，但 AC-02/AC-06 的实现语义尚不能作为最终 PASS。 |

## 3. 交付物与计划符合度：F01～F12 处置对质

| R1 发现 | 状态 | 代码/文档证据 | 一句话理由 |
| --- | --- | --- | --- |
| F01 | PARTIAL | `tools/contract-gen/src/main.rs`、`src/generated/types.rs` | 已从 OpenAPI 枚举 42 名称并确定性生成四文件，但每类都只是任意 JSON 包装，未与 schema 结构对应。 |
| F02 | FIXED | Cargo.lock 的 `jsonschema`/`acdp-jcs`；`dshd-contract` 两项测试 | 已从 contains 字符串判断升级为 Draft 2020-12 validator 与标准 JCS 库调用；覆盖深度另记关注项。 |
| F03 | FIXED | `contract-gen --check`、`drift_gate.rs`、`drift-real` | clean 基于真实生成输出比较，损毁受管生成物后同一 gate 确实非零，恢复后归零。 |
| F04 | FIXED | `tools/conformance-runner/vectors.csv` | 66 ID 逐行存在，分组数、规范引用、owner、driver、状态与证据列齐全。 |
| F05 | FIXED | runner `load/validate` 与三种输出；`selftests-real` | 自检真实读取 manifest，损毁副本失败，文本/JSON/JUnit 均诚实报告 66/0。 |
| F06 | FIXED | `fake-harness/src/main.rs` 与真实 self-test 输出 | 自检实际绑定随机 loopback 并探测认证、cookie/authority、HTTP 成败；WS 明确 NOT_IMPLEMENTED。 |
| F07 | PARTIAL | `reference-stub/src/main.rs` | Registry 三动作已真实 client→server，但冻结要求的 Management/Proxy 路由未落地，打印的 13 路由无数据模型支撑。 |
| F08 | PARTIAL | inventory.csv 与 capability `load/validate` | 34 项及双证据成对规则、同源 JSON/Markdown 已有，但校验只按前缀计数，未知 ID 可替换合法 ID 后通过。 |
| F09 | FIXED | `.github/workflows/m1.yml` | contract-generate/fmt/clippy/check/test/assets 已拆分且真实调用仓库工具。 |
| F10 | FIXED（静态） | Dockerfile 的 `/harness-closure` | runtime 不再复制整个 `/harness`，只复制 builder 组装并检查的 closure；运行证据仍 PENDING。 |
| F11 | FIXED | `rust-toolchain.toml` | 明确固定 `x86_64-unknown-linux-gnu` target。 |
| F12 | FIXED | `exit-record.md` | AC-02 引用真实 check/损毁门，CI/Docker 保留 PENDING，66/0 口径诚实。 |

结论：R1 的 F03/F04/F05/F06/F09/F10/F11/F12 已得到针对性修复，F02 达到“真实库校验而非字符串判断”的原发现关闭条件；F01、F07、F08 仍未完全修复，不能接受“全部发现已修复”的实现方声明。

## 4. 代码评审

对可取得的迭代基线 `c42ba1f..a4116af` 通读 crates/ 与 tools/ 增量；PROMPT 指定的 `c2c7a06` 不存在于当前浅克隆对象库，因此未虚构该 revision 的 diff。当前两次实现提交的范围清晰，`git diff --check` 无报错，冻结目录零变更。

正确性方面，manifest 解析、重复/遗漏检测和真实负向门已从 R1 的常量自洽显著提升；fake/stub 使用 loopback 避免外部依赖。错误处理方面，命令行工具会对 manifest/inventory/generator 错误返回非零，整体趋向 fail-closed。确定性方面，生成输入 SHA-256、排序后的 schema 名称、BTreeMap 输出及 `--regen` 后零 git diff 可重放。

主要缺陷是生成器只读取 schema 顶层关键字并忽略其内容，输出 `pub struct X(pub serde_json::Value)`；即使属性类型、required、oneOf 或 enum 改变，只要受管文件同步再生，Rust 类型语义仍完全相同。其次，reference stub 的 `routes=13` 不来自 registry，成功判断只有三个字符串分支；capability-report 只检查 `starts_with(prefix)` 数量，没有构造 WUI-001～021、DSHD-001～004、OUT-001～009 的精确 expected set，也未校验 status 枚举。这些会让自检在错误资产上产生假阳性。

冻结边界方面未见 `dsh/` 或 `docs/contracts/` 修改，也未引入独立业务 DTO；所有尚未实现的业务行为继续显式输出 `NOT_IMPLEMENTED`，这一点符合 M1 边界。

## 5. 真实测试复跑记录

以下均为本评审在 2026-08-29 当前工作树亲自执行所得，不引用实现方自报替代输出。

| 命令 | 退出码 | 真实输出摘要 |
| --- | ---: | --- |
| `node tools/check-m1-impl-r2.mjs --mode drift-real` | 0 | `RESULT=PASS MODE=drift-real`；脚本先做 ZERO_DRIFT，再损毁真实生成物并要求 `contract-gen --check` 非零，恢复后复检成功。另有 Node `DEP0190` warning，不影响退出码。 |
| `node tools/check-m1-impl-r2.mjs --mode selftests-real` | 0 | `RESULT=PASS MODE=selftests-real`；四资产版本/自检及 manifest/inventory 损毁副本负向门均通过。 |
| `cargo test --workspace --locked` | 0 | canonical-json 0 tests；capability、runner、contract-gen 各 1；dshd-contract 2 unit + 1 drift；其余 0；全部 `test result: ok`。drift 子进程输出 `RESULT=PASS ZERO_DRIFT files=4`。 |
| `cargo run --locked -p contract-gen -- --check` | 0 | `RESULT=PASS ZERO_DRIFT files=4`。 |
| `cargo run --locked -p contract-gen -- --regen` | 0 | `RESULT=PASS REGENERATED schemas=42 generator=m1-controlled-generator/0.2.0`；随后 `git status --short` 仅 `?? PROMPT.md`，证明生成物确定性。 |
| 临时 venv `pip install -r docs/contracts/requirements-contracts.txt` | 0 | 安装锁定 `openapi-spec-validator==0.7.1`、`PyYAML==6.0.2`、`jsonschema==4.26.0`。 |
| 临时 venv `python docs/contracts/validate_contracts.py` | 0 | `Contract validation: PASS`；OpenAPI 10 paths、42 schemas、179 refs；Conformance 66 declared、0 executed。 |
| conformance-runner `--version` / `--self-test` | 0 / 0 | `0.2.0`；`SELF_TEST=PASS ... declared=66 executed=0 passed=0 failed=0`。 |
| fake-harness `--version` / `--self-test` | 0 / 0 | `0.2.0`；动态 `ready=http://127.0.0.1:60038/...`、`probe=HTTP_OK`、`authority_cookie=PASS`、`ws=NOT_IMPLEMENTED`。 |
| reference-stub `--version` / `--self-test` | 0 / 0 | `0.2.0`；动态 `registry=http://127.0.0.1:60042`，client 执行 register/heartbeat/deregister，打印 routes=13、NOT_IMPLEMENTED。 |
| capability-report `--version` / `--self-test` | 0 / 0 | `0.2.0`；`capabilities=34 covered=0 parity_evidence=0`。 |

复跑本身为 PASS，但测试通过不能把未被断言的 schema 类型保真、十条额外 stub 路由或精确 capability ID 合法性推导为 PASS。

## 6. 新发现问题

### F13

- 维度：代码评审
- 严重度：BLOCKER
- 位置：`crates/dshd-contract/src/generated/types.rs`
- 原文：`pub struct BadRequestErrorResponse(pub serde_json::Value);`
- 问题：42 个生成名称全部采用同一种透明任意 JSON 包装，OpenAPI 的 properties、required、enum、oneOf、allOf 与标量格式均未映射为 Rust 类型；这不满足冻结 T03 的 schema 类型生成，也使“无第二套 DTO”的契约边界无法提供静态约束。
- 建议：让受控生成器实际递归映射冻结 schema，生成字段/枚举/联合/引用对应的可编译类型；增加代表性 schema golden tests，证明改变属性或联合会改变生成类型。

### F14

- 维度：交付物与计划符合度
- 严重度：MAJOR
- 位置：`tools/reference-stub/src/main.rs`
- 原文：`routes=13 behavior=NOT_IMPLEMENTED vectors_executed=0`
- 问题：self-test 只请求 register、heartbeat、deregister 和一个 unknown；服务端也仅识别前三条，却无条件报告 routes=13。R1 F07 要求的 Management/Proxy client 路由齐全仍未由代码或运行时 registry 证明。
- 建议：用单一 route registry 枚举冻结的 13 条 server/client 路由，服务分发与报告均从 registry 派生，并让 self-test 逐条请求、核对显式 NOT_IMPLEMENTED 响应。

### F15

- 维度：代码评审
- 严重度：MAJOR
- 位置：`tools/capability-report/src/main.rs`
- 原文：`c.id.starts_with(prefix)).count() != n`
- 问题：校验只约束前缀计数；把 `WUI-001` 换成 `WUI-999` 仍可通过，只要数量不变，且 status 未校验。这不满足冻结 inventory 的稳定 ID 与未知项拒绝规则。
- 建议：构造 34 个精确 expected ID 的集合并与实际集合相等比较，同时校验各 kind 对应 ID、允许的 status 及证据/status 一致性；为未知 ID、错 kind、错 status 增加负测。

## 7. 无问题确认清单

- 已确认 R1 F01～F12 每项均有独立处置判断，没有仅抄录 `iteration-r2-fixes.md`。
- 已确认 Cargo.lock 含 `jsonschema`、JCS 实现 `acdp-jcs` 与本地适配 crate。
- 已确认 vectors.csv 恰为 66 项，分组为 4/4/14/13/13/15/3，未把 declared 冒充 executed。
- 已确认 drift-real 和 selftests-real 的真实负向门均会拒绝损毁副本并恢复工作树。
- 已确认 `.github/workflows/m1.yml` 的 job、`--locked`、validator、contract-gen 与四资产入口真实存在。
- 已确认 `rust-toolchain.toml` 固定 Linux target，Dockerfile 不再把 `/harness` 整树复制到 runtime。
- 已确认 exit-record 对 CI/Docker 证据保持 PENDING，AC-01/VM-01 采用 BLOCKED-EXTERNAL 口径。
- 已确认 `dsh/`、`docs/contracts/` 零改动，未发现第二套业务 DTO，业务占位明确。
- 已确认复跑后除本报告外没有生成文件漂移，`PROMPT.md` 始终保持未跟踪。

## 8. 下一步建议

当前不得进入步骤 6 里程碑交付简报。必须先修复 F13：生成与 42 个 schema 结构对应的强类型 DTO，并以字段/枚举/联合 golden tests 证明保真；修复 F14：由真实 route registry 驱动并逐条探测 13 路由；修复 F15：capability inventory 精确 ID/status fail-closed。修复后应再次执行 cargo test、contract-gen clean/dirty/restore、manifest/inventory/route 负向门与本地 validator，并由新的独立评审决定是否通过。AC-01/VM-01 与 Docker smoke 可继续按外部阻断/PENDING 诚实保留，不得用本地机械门替代远端证据。
