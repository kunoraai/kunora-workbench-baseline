# M1「工程与验收基础」第三轮独立验收报告（R3）

## 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| R3 | 2026-08-29 | Remote Agent | 独立复审迭代 3 对 F13/F14/F15 的修复及迭代 4 对 Windows socket 稳定性的修复；重新核对冻结文档、实现代码并亲自复跑规定门禁。 | `acceptance-r2.md`、M1 三份冻结文档、全部实现方报告、当前代码与本机真实输出 |

## 1. 总体结论

总体结论：通过独立验收

R2 的三个未关闭问题均已由可运行实现和针对性负测充分修复。`contract-gen` 不再生成 42 个任意 JSON 透明包装，而是从冻结 OpenAPI 递归生成字段、可选性、枚举、联合和引用；reference stub 由单一 `ROUTES` registry 驱动分发、探测和计数，并逐条得到 `route_probe=13/13 PASS`；capability-report 对 34 个 ID/kind 做精确集合比较并 fail-closed 拒绝未知、缺失、错 kind、非法 status 和证据不一致。迭代 4 还消除了调用方曾观察到的 Windows WSA 10004/10053 恐慌路径，本次连续三次 stub 自检均 exit 0、无 panic。

| 维度 | 结论 | 独立判断 |
| --- | --- | --- |
| 阶段目标达成 | PASS | 本地可验证的 AC-02、AC-03、AC-05～AC-07 已满足；AC-01/VM-01 仍因 GitHub Actions 计费外阻记 `BLOCKED-EXTERNAL`，Docker 证据仍为 PENDING，均按指定环境口径保留。 |
| 交付物与计划符合度 | PASS | D3 生成链、D7 stub 骨架、D9 capability inventory 的 R2 语义缺口已关闭；M1 仍诚实维持 `declared=66 executed=0` 与 `NOT_IMPLEMENTED` 边界。 |
| 代码评审 | PASS | 三项修复均由单一权威输入派生并配有正负测试；socket 采用有界重试、完整响应判定、完成信号及显式错误传播。 |
| 真实测试复跑 | PASS | workspace 测试、golden、check/regen/drift、三次 stub self-test、fake/runner self-test 和临时 venv `validate_contracts` 全部真实 exit 0。 |

## 2. 阶段目标达成：AC/VM 重估

### 2.1 AC-01～AC-07

| 标准 | 状态 | R3 证据与判断 |
| --- | --- | --- |
| AC-01 干净检出 CI 一次通过 | BLOCKED-EXTERNAL | GitHub Actions 账户计费造成 startup failure 的外部事实沿用，不将本地结果替代远端单次完整 run，也不记实现缺陷。 |
| AC-02 生成链与人为 drift | PASS | 42 个 schema 均由 OpenAPI 结构生成；`--check` 为 `ZERO_DRIFT files=4`，`--regen` 为 `schemas=42 generator=m1-controlled-generator/0.3.0`；真实 drift 负测拒绝损毁并恢复。 |
| AC-03 CI 执行契约验证器 | PASS（本地与静态） | 临时原生 Windows Python 3.12 venv 安装锁定 requirements，`validate_contracts.py` exit 0，输出 10 paths、42 schemas、66 declared、0 executed；远端执行仍受 AC-01 外阻。 |
| AC-04 Docker skeleton | PENDING | 仍无本机 Docker 或成功远端 build/smoke 原始证据；保持 PENDING，不推导镜像 PASS。 |
| AC-05 工具链与 lock | PASS | 锁定 Rust/Cargo 依赖可在本机以 `--locked` 完整编译测试。 |
| AC-06 四资产版本、自检、66/0 | PASS | stub 逐条探测 13 条路由；fake 自检真实 loopback；runner 报告 `declared=66 executed=0`；capability 精确验证 34 项。 |
| AC-07 冻结边界 | PASS | 本轮未改变 `dsh/`、冻结契约或冻结计划；没有第二套业务 DTO，未实现行为继续明确为 `NOT_IMPLEMENTED`。 |

### 2.2 VM-01～VM-06

| 方法 | 状态 | 说明 |
| --- | --- | --- |
| VM-01 新 clone、无缓存完整 CI | BLOCKED-EXTERNAL | GitHub Actions 计费外阻尚未消失，不能拼接本地结果冒充远端同次 pipeline。 |
| VM-02 契约验证器与机器报告 | PASS（本地） | 原生 Windows 临时 venv 中 validator 输出 `Contract validation: PASS`、10/42/66 和 179 local refs。 |
| VM-03 四资产版本、自检、清单 | PASS | reference-stub 连续三次 13/13；fake-harness 和 conformance-runner 自检 exit 0；capability 的精确集合负测纳入 workspace test。 |
| VM-04 构建并启动 skeleton 镜像 | PENDING | Docker 原始证据仍缺失，沿用冻结口径诚实保留。 |
| VM-05 diff、工具链、摘要 | PASS | regen 与 drift 恢复后 `git status --short` 仅 `?? PROMPT.md`；冻结输入未改。 |
| VM-06 出口记录 | PASS | 证据仍明确区分声明与执行，外部 CI/Docker 未被提升为 PASS。 |

### 2.3 T01～T25 覆盖复核

| 任务 | 状态 | R3 复核摘要 |
| --- | --- | --- |
| T01 | PASS | 冻结输入与 10/42/66 基线未变。 |
| T02 | PASS | `$ref`、oneOf、required/nullable、additionalProperties 等生成验收矩阵仍有效。 |
| T03 | PASS | 42 schema 现为结构化 Rust 类型并通过 workspace 编译。 |
| T04 | PASS | `jsonschema` Draft 2020-12 与 JCS 正反测试继续通过。 |
| T05 | PASS | 受控生成器 0.3.0 直接消费冻结 OpenAPI，未降低语义为通用 Value 包装。 |
| T06 | PASS | clean check、regen 确定性与 drift 负向门均真实通过。 |
| T07 | PASS | 66-vector manifest 的精确 ID 与分组未变。 |
| T08 | PASS | runner 自检真实读取 manifest，输出 `declared=66 executed=0`。 |
| T09 | PASS | 四类资产的统一版本、自检与显式未实现口径保持。 |
| T10 | PASS（M1 骨架） | fake Harness 的 loopback、认证与拒绝探针通过，WS 仍诚实为 NOT_IMPLEMENTED。 |
| T11 | PASS（M1 骨架） | 单一 ROUTES registry 覆盖 Registry 与 Management/Proxy 的 13 条骨架路由，逐条探测；三项 Registry client 行为保留。 |
| T12 | PASS | capability 精确 expected ID/kind 集合、status 与 evidence 规则均 fail-closed。 |
| T13 | PASS | workspace 生成类型与所有 crate 可构建，无越界业务实现。 |
| T14 | PASS（M1 范围） | unit/contract 入口可执行；未把 M2+ integration/e2e 行为冒充已完成。 |
| T15 | PASS | 锁定工具链和 Cargo.lock 可重复使用。 |
| T16 | PASS | 版本与摘要机制未被本轮破坏。 |
| T17 | PASS（定义/本地） | validator、contract-gen 与 drift gate 的真实入口均通过；远端运行受外阻。 |
| T18 | PASS | workspace `cargo test --locked` 真实通过，既有 CI job 定义未改。 |
| T19 | PENDING | frozen Harness builder 定义保留，缺 Docker 原始运行证据。 |
| T20 | PENDING（运行证据） | runtime closure 的静态边界保留，待 Docker build 证明。 |
| T21 | PENDING | Docker smoke 仍无可验证执行证据。 |
| T22 | PASS | 资产自检语义缺口已关闭，尤其 stub 13/13 与 capability 精确集合。 |
| T23 | BLOCKED-EXTERNAL | 新 clone 同次完整 pipeline 仍被计费外阻挡。 |
| T24 | PASS | 冻结目录、契约权威与 M1 业务边界未被改变。 |
| T25 | PASS（诚实性） | 出口信息可据本报告更新，外部与 PENDING 项保持明确。 |

## 3. 交付物与计划符合度：R2 发现处置对质

| 项目 | 状态 | 实现方主张 | 独立对质证据 |
| --- | --- | --- | --- |
| F13 | FIXED | 递归映射 42 schema，并用 golden 证明结构变化会改变生成物。 | 通读 `main.rs` 确认 properties、required、enum、oneOf、`$ref`、array、allOf 与 additionalProperties 的递归路径；生成文件含命名字段、Rust enum、`#[serde(untagged)]` 和引用类型。抽查六项 schema 逐字段一致，golden 2/2 真实通过。 |
| F14 | FIXED | 单一 ROUTES 同时驱动分发、探测和计数，13 条均返回显式 NOT_IMPLEMENTED。 | `ROUTES` 恰有 13 项；dispatch 用 `ROUTES.iter().any`，probe 循环直接遍历 ROUTES，分母为 `ROUTES.len()`；连续三次均输出 `route_probe=13/13 PASS`。register/heartbeat/deregister 仍列于 registry 并由 client 实际请求。 |
| F15 | FIXED | expected 34 项精确集合比较并拒绝全部错误类别。 | 代码构造 WUI-001..021、DSHD-001..004、OUT-001..009 的 ID/kind 映射；workspace test 的 3 项含 WUI-999 同数替换，以及错 kind/status/evidence 负测，全部通过。 |
| Windows socket 稳定性 | FIXED | 对 WSA 10004/10053 等瞬时错误有界重试，线程以完成信号退出。 | reference-stub 与 fake-harness 都定义 3 次尝试、短退避、读写超时及 Content-Length 完整响应判断；server 非阻塞 accept，client 完成后发信号并 join。瞬时 IO 路径未见 `unwrap()/expect()`；连续三次实测无恐慌。 |

R1 的 F01～F12 已在 R2 逐项核验；其中当时遗留的 F01、F07、F08 分别由本轮 F13、F14、F15 的修复完全关闭，其余 F02/F03/F04/F05/F06/F09/F10/F11/F12 的既有修复没有被回归。这里的“关闭”只针对 M1 骨架及冻结验收语义，不代表 66 个产品一致性向量已经执行。

## 4. 代码评审

### 4.1 F13 生成器与六项 schema 抽查

生成器以 `serde_yaml` 解析 `components.schemas`，先强制数量恰为 42，再按名称排序输出。对象属性按名称排序，required 字段生成直接类型，非 required 字段生成 `Option<T>`；字符串枚举生成带 serde rename 的 Rust enum；oneOf 生成 `#[serde(untagged)]` 联合；本地 `$ref` 直接生成具名类型引用；开放对象的 additionalProperties 通过 flatten 的 `BTreeMap` 表示。`--check` 比较四个受管文件的完整内容，`--regen` 仅写这四个文件。

| OpenAPI schema | 冻结 schema 结构 | 生成 Rust 对照 | 结论 |
| --- | --- | --- | --- |
| RegistrationRequest | 8 个属性；除 predecessor_instance_id 外 7 项 required | 8 个命名字段；predecessor 为 `Option<UuidV4>`，其余为直接类型；capabilities 为 `Vec<Capability>` | 一致 |
| HeartbeatRequest | lease_id、sequence、observed_at、daemon、harness、proxy、resources 全部 required | 七个直接类型字段，引用分别落到 UuidV4、Timestamp 及具名 fact 类型 | 一致 |
| HarnessFact | 6 个 required；last_error 为 ErrorDetail/null 联合 | 六个直接字段；`HarnessFactLastError` 为 untagged 的 ErrorDetail 与 `()` 两分支 | 一致 |
| Operation | 10 个属性；operation_id/type/state/no_op/requested_at required | 五个 required 为直接类型，其余五项为 Option；`type` 正确转义为 `r#type` | 一致 |
| StatusResponse | 9 个属性且全部 required，均为具名契约类型 | 九个直接字段逐项引用 ProtocolVersion、NodeId、UuidV4 与各状态/fact 类型 | 一致 |
| DaemonState | enum 为 STARTING、READY、STOPPING | Rust enum 三变体及 serde rename 完整一致 | 一致 |

golden 测试不是只检查类型名称：第一项核对确定性及代表性字段、枚举、联合片段；第二项分别修改属性（新增 integer）、枚举值和 nullable union 分支，逐次断言 `types.rs` 随输入改变。本次 `cargo test` 中两项均为 ok，因此 R2 指出的“只看名称”假阳性已被针对性覆盖。

### 4.2 F14 路由与稳定性

13 条 route 数据只有一个 `ROUTES` 常量来源。服务分发、客户端逐项 probe 和输出分母都消费同一数组，避免过去固定打印 routes=13 的脱节。每个 probe 既要求 HTTP 200，又要求 body 含 `NOT_IMPLEMENTED`；未知路由走 404。Registry 的 PUT register、PUT lease heartbeat、DELETE deregister 是 registry 的前三项，实际探测未被移除。

稳定性方面，10004、10053 连同 ConnectionAborted、ConnectionReset、Interrupted、TimedOut、WouldBlock 等被明确归为瞬时错误；连接级最多 3 次尝试并有 25/50ms 退避。响应完整性由 Content-Length 判断，不依赖 EOF；listener 以非阻塞循环响应完成信号，随后 join server thread，不再通过关闭另一线程的阻塞 socket 来终止。`unwrap_or` 只用于纯字符串解析的安全默认值，瞬时 bind/accept/connect/read/write/shutdown 和 thread result 均通过 Result 传播，不存在相关 `unwrap()`/`expect()` 恐慌点。

### 4.3 F15 精确集合

capability-report 将实际 inventory 先校验重复 ID，再与 34 项精确 expected map 比较；这同时发现未知、缺失与错 kind。status 限于 allowed enum，covered/pending 与 evidence 数量必须一致，WUI 双证据成对规则继续保留。负测把 WUI-001 替换为 WUI-999 而不改变数量，仍被拒绝，证明旧的仅按前缀计数漏洞不可绕过。

## 5. 真实测试复跑记录

以下输出均由本评审于 2026-08-29 在当前 Windows 工作树亲自执行。第一次调用 drift 脚本因当前 PowerShell PATH 未含 Git 而在测试前以 ENOENT 退出，未计为有效门禁结果；补齐 PATH 后重新执行得到下表有效结果。临时 venv 首先尝试 MSYS2 Python，因 Cygwin wheel 平台不受 `rpds-py` 支持而安装失败；随后使用原生 Windows Python 3.12 新建临时 venv，锁定依赖安装和验证器均成功。报告不把工具启动失败捏造成测试通过。

| 命令 | 退出码 | 真实输出摘要 |
| --- | ---: | --- |
| `cargo test --workspace --locked` | 0 | capability-report 3/3、contract-gen golden 2/2、runner 1/1、dshd-contract 2/2、drift gate 1/1，全部 `test result: ok`；子进程 `ZERO_DRIFT files=4`。 |
| `cargo run --locked -p contract-gen -- --check` | 0 | `RESULT=PASS ZERO_DRIFT files=4`。 |
| `cargo run --locked -p contract-gen -- --regen` | 0 | `RESULT=PASS REGENERATED schemas=42 generator=m1-controlled-generator/0.3.0`；随后 git status 仅 `?? PROMPT.md`，确定性成立。 |
| `node tools/check-m1-impl-r4.mjs --mode drift-real` | 0 | 补齐 Git/Cargo PATH 后输出 `RESULT=PASS MODE=drift-real`；负向损毁被拒绝、恢复后仍只有未跟踪 PROMPT.md。 |
| `cargo run --locked -p reference-stub -- --self-test`（第 1 次） | 0 | `SELF_TEST=PASS ... route_probe=13/13 PASS behavior=NOT_IMPLEMENTED vectors_executed=0`，端口 63634，无 panic。 |
| 同命令（第 2 次） | 0 | `SELF_TEST=PASS ... route_probe=13/13 PASS ...`，端口 63648，无 panic。 |
| 同命令（第 3 次） | 0 | `SELF_TEST=PASS ... route_probe=13/13 PASS ...`，端口 63662，无 panic。 |
| `cargo run --locked -p fake-harness -- --self-test` | 0 | `SELF_TEST=PASS`，含 `probe=HTTP_OK authority_cookie=PASS`、三项 fixtures、`ws=NOT_IMPLEMENTED vectors_executed=0`。 |
| `cargo run --locked -p conformance-runner -- --self-test` | 0 | `SELF_TEST=PASS ... declared=66 executed=0 passed=0 failed=0`。 |
| 临时 venv `python docs/contracts/validate_contracts.py` | 0 | `Contract validation: PASS`；OpenAPI 10 paths、42 schemas、179 refs；Conformance 66 declared、0 executed。 |

三次 reference-stub 结果说明在本机正常调度下没有重现 10004 或 10053，但这不等于能够人为穷举 Windows 内核的所有时序；关闭判断同时依赖代码中对这两个 raw OS error 的显式分类、有界重试、完成信号和无瞬时 IO unwrap/expect。该组合为缺陷原因提供了直接修复，而非仅靠重复运行掩盖偶发错误。

## 6. 新发现

未发现需要从 F16 起编号的新问题。静态审查与真实复跑没有产生阻断 M1 接受的新证据；AC-01/VM-01 的 `BLOCKED-EXTERNAL` 及 Docker PENDING 是既知环境/证据状态，不是本轮新增代码缺陷。

## 7. 无问题确认清单

- 已实际读取 `acceptance-r2.md`、`six-elements.md`、`overall-plan.md`、`detailed-plan.md`、reports/ 全部文件以及 PROMPT 指定实现代码。
- 已逐项对质 F13、F14、F15 与 Windows 稳定性修复，没有以 iteration-r3/r4 自报替代代码和运行证据。
- 已确认 42 schema 不再统一退化为 `serde_json::Value`，并完成至少五项具名 schema 的字段级对照。
- 已确认 golden 覆盖属性、枚举和联合变更，且真实测试 2/2 通过。
- 已确认 ROUTES 是分发、探测、计数的单一来源，连续三次 `route_probe=13/13 PASS`。
- 已确认 10004、10053 被显式视为瞬时错误且重试有界，线程通过完成信号收束。
- 已确认 capability expected 集合恰为 34 项，WUI-999 同数替换、错 kind、非法 status、证据不一致均 fail-closed。
- 已确认 `jsonschema`、contract-gen、cargo test、self-test、drift 与 validate_contracts 的真实链路均有本轮输出。
- 已确认 66 只表示声明数量，始终报告 `declared=66 executed=0`，未冒充行为测试已执行。
- 已确认 AC-01 与 VM-01 继续为 BLOCKED-EXTERNAL，Docker build/smoke 继续 PENDING。
- 已确认 regen/drift 复跑后无受管文件变化，`PROMPT.md` 保持未跟踪。

## 8. 下一步建议

建议进入步骤 6 里程碑交付简报，以本报告作为 M1 本地独立验收结论；简报必须继续明确 AC-01/VM-01 的 GitHub Actions 计费外阻和 Docker PENDING，待外部条件恢复后补做同一次干净 CI 与镜像 build/smoke 原始证据。M2 只能在既有 driver、manifest 与生成契约边界内增量填充，不得把当前 `declared=66 executed=0`、stub `NOT_IMPLEMENTED` 或 capability covered=0 解释为产品行为通过。
