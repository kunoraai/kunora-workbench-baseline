# M1「工程与验收基础」独立验收报告（R1）

## 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| R1 | 2026-08-29 | Remote Agent | 对提交 `ab47138` 的 M1 步骤 3 交付执行独立验收；复核冻结文档、实现代码、自报报告并真实复跑指定命令。 | `six-elements.md`、`detailed-plan.md`、`overall-plan.md`、冻结契约与本地机器证据 |

## 1. 总体结论

总体结论：未通过独立验收——现有 workspace 和浅层自检虽能编译通过，但 OpenAPI→Rust 生成、Draft 2020-12/JCS、真实 drift gate、66 项 manifest/报告、可启动测试替身及能力证据模型等多项冻结完成判据未实现，不能把骨架字符串与恒真断言视为 M1 工程地基完成。

四维度结论汇总：

| 维度 | 结论 | 理由 |
| --- | --- | --- |
| 阶段目标达成 | FAIL | AC-02、AC-04、AC-06 未达到冻结语义；AC-01 因已确认的计费问题为 `BLOCKED-EXTERNAL`，不计实现缺陷。 |
| 交付物与计划符合度 | FAIL | T03～T12、T14～T15、T17～T23、T25 中存在未完成或证据不足项，核心 D3、D5～D9 不能签核。 |
| 代码评审 | FAIL | 合约“validator”和 drift gate 不是实际 schema 生成/校验；工具多为打印常量，未实现计划要求的数据结构与可启动接口。 |
| 真实测试复跑 | CONCERNS | 所有明确要求的 Cargo、工具和 Python 命令真实 exit 0，但测试覆盖很浅；本机无 Docker，镜像构建/启动无法复跑。 |

## 2. 阶段目标达成

### 2.1 七条验收标准

| 标准 | 状态 | 本地证据与判断 |
| --- | --- | --- |
| AC-01 干净检出 CI 一次通过 | BLOCKED-EXTERNAL | 调用方确认 GitHub Actions 因账户计费而全部 `startup_failure`、零 job；按任务指定口径记外部阻断，不作为实现质量缺陷。静态审查 `m1.yml` 可解析出四个 jobs，Cargo 命令使用 `--locked`，且真实调用仓库 validator；但没有 `contract-generate` job，Rust 质量门禁也未按计划拆分。 |
| AC-02 生成链与人为 drift | FAIL | `Cargo.lock` 只有 8 个本地包，无 OpenAPI generator、jsonschema 或 JCS Rust 依赖；代码未生成 42 个类型。`drift_gate.rs` 仅对同一输入计算两次指纹及对追加字符串后的输入比较指纹，没有执行生成、比对版本化生成物或证明 gate 会失败。 |
| AC-03 CI 执行契约验证器 | PASS（定义静态、本地复跑） | workflow 确实安装 `requirements-contracts.txt` 并调用 `python docs/contracts/validate_contracts.py`；独立临时 venv 复跑 PASS：10 paths、42 schemas、66 declared、0 executed。远端机器日志因 AC-01 外阻不存在。 |
| AC-04 Docker skeleton 可构建并启动 | PENDING | Dockerfile 具三阶段并声明 Node 24/tini/flock/CA；本机 `docker=MISSING`，无真实 build/smoke。且 runtime 复制整个 `/harness` 而非经过验证的最小 runtime closure，不能先行记 PASS。 |
| AC-05 工具链与 lock 摘要 | PASS | Rust 固定为 1.89.0，Cargo.lock 已提交；`release-manifest.ps1` 复跑 exit 0，输出 Cargo.lock SHA-256 `f7469bf8…0fff`、toolchain SHA-256 `7b4a47a1…96d4`、Harness lock SHA-256 `506ad1fc…caf1`。但 `rust-toolchain.toml` 未固定构建 target，见发现。 |
| AC-06 四类资产版本、自检、66/0 | FAIL | 四工具 `--version`/`--self-test` 均 exit 0，runner 打印 `declared=66 executed=0 passed=0 failed=0`；但 manifest 没有逐项 66 ID，JSON/JUnit 报告不存在，fake/stub 不可启动，capability 工具无 ID/双证据模型，不能仅凭常量输出签核资产语义。 |
| AC-07 冻结边界 | PASS | 对实现提交前基线 `85be9517…` 到 `ab47138…` 的 diff，`dsh/` 与 `docs/contracts/` 均零改动；代码未出现第二套 Registry/Management DTO，业务占位明确输出 `NOT_IMPLEMENTED`。 |

### 2.2 六步验收方法

| 方法 | 状态 | 说明 |
| --- | --- | --- |
| VM-01 新 clone、无缓存完整 CI | BLOCKED-EXTERNAL | 计费问题导致零 job，不能形成一次全绿证据；本地 `cargo clean` 自报不能替代新 clone CI。 |
| VM-02 契约验证器与机器报告 | PASS（本地） | 本评审在临时 venv 安装锁定依赖并真实得到 PASS；远端 artifact 仍缺失。 |
| VM-03 四资产版本、自检、清单 | FAIL | 入口可运行，但自检没有从真实 manifest/数据模型验证完整语义；runner 的 66 ID 是算法现场生成，不是 manifest 精确枚举。 |
| VM-04 构建并启动 skeleton 镜像 | PENDING | 本机没有 Docker，未伪造输出；CI 又被外部阻断。 |
| VM-05 diff、工具链、摘要 | PASS | `dsh/` 零 diff，工具链与摘要已核对；target 固定缺口另列。 |
| VM-06 出口记录 | FAIL | `exit-record.md` 是诚实的 PENDING 骨架，但把不具冻结语义的 drift 测试记为 AC-02 PASS，且缺少计划要求的 commit/run/完整版本摘要与原始 artifact 索引。 |

## 3. 交付物与计划符合度：T01～T25 逐任务核验

| 任务 | 判据摘要 | 核验证据 | 结论 |
| --- | --- | --- | --- |
| T01 | 摘要、版本、10/42/66、只读边界 | `t01-baseline-verification.md` 有摘要缩写和边界记录；validator 独立复跑确认 10/42/66。 | PASS |
| T02 | `$ref`、联合、nullable、错误响应及正反预期 | 矩阵列出类别和预期，但没有对应 fixture/样例清单，尤其 CT 覆盖无法追踪。 | CONCERNS |
| T03 | 固定候选，生成并编译 42 schema 类型 | 报告明确“未声称已经生成完整 42 个强类型 DTO”；contract crate 只嵌入 YAML 和算指纹。 | FAIL |
| T04 | Draft 2020-12 全部正反例与标准 JCS 探针 | `contains` 字符串判断不是 JSON Schema validator；无 JCS 依赖，报告也明确未实现 JCS。 | FAIL |
| T05 | 后备实现确定、fail-closed、golden tests | 仅以非加密 64 位指纹表示“受控生成器”，没有 schema 映射、未知关键字拒绝或 golden tests。 | FAIL |
| T06 | 真生成零 diff，隔离 drift 必然使 gate 失败 | 两项测试仅比较输入指纹，clean 断言是表达式与自身相等；没有生成输出与失败 gate。 | FAIL |
| T07 | manifest 精确枚举 66 项及元数据 | `vectors.csv` 只有七个分组计数行，未枚举 66 ID，也无规范引用、driver、证据位置。 | FAIL |
| T08 | 版本、自检、JSON/JUnit 诚实报告 | 版本和文本 self-test 可运行且打印 66/0；没有 JSON/JUnit 输出，自检不读取 CSV。 | FAIL |
| T09 | 统一 version/self-test/scenario/artifact/transcript 协议 | 四个独立 main 使用相似字符串，但仓库不存在统一 artifact schema、scenario schema 或脱敏 transcript 约定。 | FAIL |
| T10 | fake Harness 可启动并提供接口及完整故障场景 | 代码只有 16 个场景字符串和自检输出，无 listener、ready URL、cookie、HTTP/WS fixture 接口；场景也少于总体方案列举。 | FAIL |
| T11 | reference stub 双向路由齐全、未实现明确返回 | 代码只有 13 个标签字符串，无 Registry server/client、路由、状态模型或可启动网络入口。 | FAIL |
| T12 | capability ID 主键、双证据校验、诚实空报告 | 工具只打印 `covered=0`，没有 inventory、ID、artifact schema 或双证据校验。 | FAIL |
| T13 | workspace、边界、依赖方向、无环 | 八成员 workspace 可构建；产品/工具分离，依赖方向无环，核心与适配器模块占位清晰。 | PASS |
| T14 | unit/contract/integration/e2e 明确入口 | contract 有 Rust 测试；integration/e2e 只有 README，没有可执行入口或统一分层命令。 | CONCERNS |
| T15 | 具体 Rust、components/target、lock、`--locked` | channel/components 和 lock 已固定，CI Cargo build/check/test/clippy 使用 `--locked`；未声明具体 target。 | CONCERNS |
| T16 | Rust 版本与 lock 摘要可重复生成 | 脚本真实 exit 0，输出 rustc/cargo 及三项 SHA-256。 | PASS |
| T17 | CI validator、生成、contract jobs | validator 与 drift/工具 jobs 存在；缺失真正 `contract-generate`，没有保留 10/42/66 机器 artifact。 | FAIL |
| T18 | fmt/clippy/check/unit/contract 分 job 且 locked | 本地 fmt/clippy/check/test 通过；workflow 把 fmt/clippy/check/test 合并为 quality，未按冻结计划分 job，contract 语义浅。 | CONCERNS |
| T19 | frozen Harness install/build，不浮动 | Node 24、pnpm 11.7.0、frozen lock 均声明；实际 Docker 构建受阻，无法证明仅先复制根 manifest/lock 后的 workspace install 可成功。 | PENDING |
| T20 | 双 builder + runtime，包含运行依赖、不含构建链 | 三阶段表面齐全；runtime 基于 Node slim 并安装 tini/flock/CA，但复制整个 Harness 工作树而非经验证的 runtime closure。 | CONCERNS |
| T21 | 干净 Docker build 与确定启动行为 | smoke 定义运行 `--version`，但本地无 Docker、远端零 job；无真实 build/run 证据。 | PENDING |
| T22 | 四资产在 CI 执行版本和 self-test | CI 只执行四项 `--self-test`，没有执行四项 `--version`；且工具自身不满足 T10～T12。 | FAIL |
| T23 | 新 clone/无缓存同一 pipeline 全绿 | 自报明确新 clone CI 为 PENDING；外部阻断按事实保留，不能签核完成。 | BLOCKED-EXTERNAL |
| T24 | `dsh/` 零改动、无第二 DTO、无行为冒充 | Git diff 支持前两项，代码普遍显式 `NOT_IMPLEMENTED`；报告没有把向量冒充执行。 | PASS |
| T25 | 七标准/六方法逐项签核和完整移交索引 | 出口骨架诚实保留部分 PENDING，但 AC-02 错签 PASS，且完整工具版本、摘要、原始 artifact/commit/run 字段未落入索引。 | FAIL |

## 4. 代码评审（按 crate/文件）

### 4.1 workspace 与产品 crate

`Cargo.toml` 的成员划分及 `dshd -> core/contract/adapters`、`adapters -> core/contract` 方向合理，无循环依赖。`dshd-core` 和 `dshd-adapters` 用模块常量明确表达 M1 占位，`dshd` 默认输出结构化 `NOT_IMPLEMENTED`，没有越界实现业务，也没有第二套 DTO。缺点是边界仅为常量而非计划所述 typed port/event/snapshot，但作为 M1 骨架可记为可维护性关注项，而非单独阻断。

### 4.2 `dshd-contract`

这是主要质量缺口。`validate_draft_2020_12_probe` 不解析 JSON，只检查两个子串，甚至字段值类型、重复键、额外字段、oneOf、required/nullable 等均不可验证。`generated_fingerprint` 不是生成器；没有生成目录、生成配置、生成 DTO 或标准 validator/JCS 依赖。clean drift 测试把同一函数同一输入结果与自身比较，无法检测版本化生成物漂移；negative 测试只能证明字符串变化会令哈希变化，不能证明 CI gate 失败。

### 4.3 `conformance-runner`

代码层固定七组数量并现场生成 ID，确实强制默认输出 `declared=66, executed=0`，不存在把 declared 冒充 passed 的问题。然而 `vectors.csv` 并非 66 项 manifest，程序也完全不读取它，所以 CSV 即使被破坏、漏项、重复或 owner 错误，自检仍会 PASS。没有计划要求的规范引用、driver、状态、证据位置以及 JSON/JUnit artifact。

### 4.4 `fake-harness`、`reference-stub`、`capability-report`

三者的错误处理基本依靠 `assert_eq!` 或无条件打印 PASS。fake 只有场景名；stub 只有路由标签；capability 工具甚至没有数据结构。因此版本入口是真实的，但自检只是常量自洽，并没有验证可启动接口、fixture、路由闭合、未知/重复 ID、双证据或 artifact digest。所有默认路径都诚实写明 `NOT_IMPLEMENTED`，这一点值得保留，但不足以达到冻结的“可运行骨架”定义。

### 4.5 CI、Docker 与脚本

workflow 中 validator 路径真实存在，Cargo `--locked` 使用正确，YAML job/needs 结构没有发现悬空引用；但缺少生成 job，quality 未分层，assets 不跑版本入口。Dockerfile 的三阶段意图正确，运行层具 Node/tini/flock/CA 且没有 Rust 基础镜像；不过复制 `/harness` 整树不等于最小 Harness closure，且没有真实 Docker 证据。发布摘要脚本结构清晰，本地复跑成功。

## 5. 真实测试复跑记录

所有下列输出均来自 2026-08-29 当前工作树真实执行；未把自报结果当作本评审结果。

| 命令 | 退出码 | 真实输出摘要 |
| --- | ---: | --- |
| `cargo check --workspace --all-targets --locked` | 0 | 检查 8 个 workspace 成员；`Finished dev profile`。 |
| `cargo test --workspace --locked` | 0 | 共运行 runner 1、contract unit 2、drift 2，其余 crate/tool 为 0 tests；全部通过。 |
| `cargo test -p dshd-contract --test drift_gate --locked` | 0 | `clean_generation_has_zero_drift`、`isolated_schema_drift_is_detected` 两项通过；断言语义缺陷见 F03。 |
| `cargo run --quiet --locked -p fake-harness -- --version` / `--self-test` | 0 / 0 | `fake-harness 0.1.0`；`SELF_TEST=PASS scenarios=16 vectors_executed=0`。 |
| `cargo run --quiet --locked -p reference-stub -- --version` / `--self-test` | 0 / 0 | `reference-stub 0.1.0`；`SELF_TEST=PASS routes=13 behavior=NOT_IMPLEMENTED vectors_executed=0`。 |
| `cargo run --quiet --locked -p conformance-runner -- --version` / `--self-test` | 0 / 0 | `conformance-runner 0.1.0`；`SELF_TEST=PASS`，并输出 `declared=66 executed=0 passed=0 failed=0`。 |
| `cargo run --quiet --locked -p capability-report -- --version` / `--self-test` | 0 / 0 | `capability-report 0.1.0`；`SELF_TEST=PASS covered=0 parity_evidence=0 status=NOT_IMPLEMENTED`。 |
| `C:\Program Files\Python312\python.exe -m venv <临时目录>\venv` | 0 | Windows Python 3.12 临时隔离环境创建成功。此前 PATH 中 MSYS Python 因 Windows 路径含 `:` 拒绝创建，已如实保留为环境尝试，不作为产品失败。 |
| `<venv>\Scripts\python.exe -m pip install -r docs/contracts/requirements-contracts.txt` | 0 | 安装/确认锁定的 `openapi-spec-validator==0.7.1`、`PyYAML==6.0.2`、`jsonschema==4.26.0`。 |
| `<venv>\Scripts\python.exe docs/contracts/validate_contracts.py` | 0 | `Contract validation: PASS`；OpenAPI 10 paths、42 schemas、179 refs；conformance 66 declared、0 executed。 |
| `cargo fmt --all -- --check` | 0 | 无格式差异。 |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | 0 | 8 个成员检查完成，无 warning。 |
| `powershell -File scripts/release-manifest.ps1` | 0 | 输出 rustc/cargo 版本及 Cargo/toolchain/Harness lock 三项 SHA-256。 |
| Docker 探测 | 不可执行 | `docker=MISSING`，因此没有声称 Docker build/smoke PASS。 |

复跑结论：现有测试的执行结果与实现方自报大体一致，但实现方将浅层指纹断言标记为 AC-02 PASS 超出了测试实际能证明的范围；本评审以代码语义审查为准。

## 6. 发现清单

### F01

- 维度：交付物与计划符合度
- 严重度：BLOCKER
- 位置：`crates/dshd-contract/src/lib.rs` · 契约生成与验证边界
- 原文：`pub const FROZEN_CONTRACT: &str = include_str!`
- 问题：实现仅嵌入冻结 YAML，未生成并编译 42 个 schema 类型，未建立冻结要求的 OpenAPI→Rust 生成链。
- 建议：引入固定版本且经矩阵验证的生成器，提交受管生成物并在 CI 临时重生成后与版本化输出比较。

### F02

- 维度：代码评审
- 严重度：BLOCKER
- 位置：`crates/dshd-contract/src/lib.rs` · `validate_draft_2020_12_probe`
- 原文：`value.contains("\"type\":\"START\"") && value.contains("\"node_id\":")`
- 问题：子串判断不是 Draft 2020-12 runtime validation，且 Cargo.lock 无 jsonschema/JCS 相关 Rust 依赖，T04 完成结论不成立。
- 建议：接入固定版本 Draft 2020-12 validator 与经过测试的 RFC 8785 JCS 实现，并以冻结 fixtures 覆盖全部正反例。

### F03

- 维度：代码评审
- 严重度：BLOCKER
- 位置：`crates/dshd-contract/tests/drift_gate.rs` · clean/negative tests
- 原文：`assert_eq!(generated, generated_fingerprint(FROZEN_CONTRACT));`
- 问题：clean 断言是同一输入同一函数自等，negative 只比较修改前后输入指纹，均未执行生成/版本化输出 diff 或断言 gate 失败。
- 建议：在隔离临时目录运行真实生成器，对 clean 输出做零 diff，并人为改变 schema 后断言同一 gate 返回非零且清理临时修改。

### F04

- 维度：交付物与计划符合度
- 严重度：MAJOR
- 位置：`tools/conformance-runner/vectors.csv` · manifest
- 原文：`group,count,status,owner`
- 问题：文件只描述七组计数，未精确枚举 66 项及规范引用、driver、状态和证据位置，不满足 T07 manifest 判据。
- 建议：将 66 个稳定 ID 逐行列入单一 manifest，并让 list/report/self-test 全部从该 manifest 解析生成。

### F05

- 维度：代码评审
- 严重度：MAJOR
- 位置：`tools/conformance-runner/src/main.rs` · `self_test`/`report`
- 原文：`let ids = vectors();`
- 问题：自检不读取 `vectors.csv`，不能发现 manifest 重复、遗漏或内容漂移，且未提供冻结计划要求的 JSON/JUnit 报告。
- 建议：解析并验证单一 manifest 的精确 ID 集、分组和状态，再由同一模型输出文本、JSON 与 JUnit 的 66/0 结果。

### F06

- 维度：交付物与计划符合度
- 严重度：MAJOR
- 位置：`tools/fake-harness/src/main.rs` · 默认入口
- 原文：`_ => println!("NOT_IMPLEMENTED fake Harness skeleton")`
- 问题：fake Harness 无可启动 listener、ready URL/cookie、HTTP/WS fixture 或故障执行接口，不能满足 T10“接口可启动”。
- 建议：实现最小 loopback 服务和确定性 scenario driver，使自检实际启动并探测认证、HTTP/WS 及异常 fixture。

### F07

- 维度：交付物与计划符合度
- 严重度：MAJOR
- 位置：`tools/reference-stub/src/main.rs` · 默认入口
- 原文：`_ => println!("NOT_IMPLEMENTED reference stub skeleton")`
- 问题：reference stub 只有字符串路由清单，没有 Registry server、Management/Proxy client 或共享状态模型，T11 双向骨架未交付。
- 建议：建立可启动双向 stub 和明确 NOT_IMPLEMENTED handler，并让自检逐路由验证 OpenAPI/Proxy 接口闭合。

### F08

- 维度：交付物与计划符合度
- 严重度：MAJOR
- 位置：`tools/capability-report/src/main.rs` · 自检
- 原文：`SELF_TEST=PASS covered=0 parity_evidence=0 status=NOT_IMPLEMENTED`
- 问题：工具无 capability ID inventory、双证据规则、artifact schema 或一致性校验，无条件打印 PASS 不满足 T12。
- 建议：实现 WUI/DSHD/OUT 主键模型、inventory/parity 双证据校验及同模型 JSON/Markdown 空报告。

### F09

- 维度：交付物与计划符合度
- 严重度：MAJOR
- 位置：`.github/workflows/m1.yml` · jobs
- 原文：`cargo test -p dshd-contract --test drift_gate --locked`
- 问题：workflow 没有真实 contract-generate job，Rust 门禁未按计划分 job，四资产也只跑 self-test 未跑 version，T17/T18/T22 不能签核。
- 建议：增加 validator→真实生成/drift→分层质量/测试的依赖链，分别执行四资产 version/self-test 并保存机器 artifact。

### F10

- 维度：代码评审
- 严重度：MAJOR
- 位置：`Dockerfile` · runtime stage
- 原文：`COPY --from=harness-builder /harness /opt/dsh`
- 问题：复制整个源码与开发安装树不能证明是冻结的最小 Harness runtime closure，且当前无真实 build/smoke 证据支撑 T19～T21。
- 建议：在 builder 生成并验证可运行 closure，仅复制 closure 与必要 Node runtime 到 runtime，并在干净 Docker 环境保存 build/启动/边界检查证据。

### F11

- 维度：交付物与计划符合度
- 严重度：MINOR
- 位置：`rust-toolchain.toml` · toolchain
- 原文：`components = ["rustfmt", "clippy"]`
- 问题：具体 channel 和 components 已固定，但 T15 明确要求的构建 target 未声明。
- 建议：按目标 Linux 构建口径增加具体 `targets` 并在所有构建与 CI 证据中记录 host/target。

### F12

- 维度：阶段目标达成
- 严重度：MAJOR
- 位置：`docs/milestones/m1/exit-record.md` · AC-02
- 原文：`AC-02 | PASS | dshd-contract/tests/drift_gate.rs 正负测试`
- 问题：该测试只证明输入指纹变化，出口记录却将“真实生成零 drift 且人为 drift 被 gate 拒绝”过度签核为 PASS。
- 建议：在修复 F01～F03 并取得真实正负机器证据前，将 AC-02 改为 FAIL/PENDING，之后引用原始 artifact 再签核。

## 7. 无问题确认清单

- `dsh/` 在实现提交相对前置基线零改动，`docs/contracts/` 同样零改动。
- 未发现与冻结 Registry/Management 契约冲突的第二套 DTO 或错误定义。
- 产品默认行为与工具未实现路径均显式使用 `NOT_IMPLEMENTED`，未宣称业务 READY。
- runner 当前文本口径始终为 `declared=66, executed=0, passed=0, failed=0`，未把清单数量冒充行为通过。
- Cargo workspace 依赖方向清晰、无循环；现有源码通过 fmt、clippy、check 和 test。
- Python validator 在隔离环境真实 PASS，workflow 调用的是仓库现有验证器而非替代实现。
- 发布摘要脚本可重复输出 Rust/Cargo 版本及三个 lock/toolchain SHA-256。
- `exit-record.md` 对 AC-01/03/04 与新 clone、Docker 等缺失证据总体保持 PENDING，没有捏造远端 CI 或 Docker 日志；唯一过签项 AC-02 已列 F12。

## 8. 给调用方的迭代建议

需要退回步骤 3 迭代。必须修复顺序建议如下：

1. 先完成 F01～F03：建立真实、固定版本的 OpenAPI→Rust/Draft 2020-12/JCS 链及真正的生成 drift 正负 gate。这是 D3 和后续 CI 的前置门，不能用哈希占位替代。
2. 完成 F04～F05：提交逐项 66 manifest，使 runner 从单一 manifest 自检并输出文本/JSON/JUnit，继续严格保持 `executed=0`。
3. 完成 F06～F08：让 fake Harness、reference stub、capability report 具备冻结方案规定的最小可运行接口、数据模型和有意义自检。
4. 重构 CI 以真实执行上述链，补四资产 version、自检与 artifact；修正 target 锁定，并在可用 Docker 环境验证最小 runtime closure。
5. 更新出口记录，撤销当前 AC-02 过度 PASS；待账户计费外阻解除后，从新 clone/无缓存跑同一次完整 CI，保存 CI run 与 Docker build/smoke 原始证据，再申请下一轮独立验收。

AC-01 的 `BLOCKED-EXTERNAL` 不要求实现方修复 GitHub 计费，但外阻解除前仍不能把“干净检出 CI 一次通过”签为 PASS。
