# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-29 | Remote Agent | 给出 M1「工程与验收基础」九项交付物的总体设计、范围、演进、风险和出口证据方案。本文只细化实现方法，不改变冻结六要素。 | `docs/milestones/m1/six-elements.md` |

# M1「工程与验收基础」总体方案

## 1. 结论与依据

M1 的最终目标不是交付任何 dshd 业务行为，而是同时建立两条可持续演进的地基：一条是可在 CI 启动的 Rust 产品工程与早期 Docker 镜像骨架，另一条是具有独立版本、自检能力和诚实执行统计的验收工具骨架。出口门禁保持冻结原文：“产品工程与验收工具均可在 CI 启动；测试资产有独立版本和自检。”66 个行为向量在本阶段只允许报告 `declared=66, executed=0`。

范围的唯一权威是 `docs/milestones/m1/six-elements.md`；技术和模块边界依据 `docs/dshd-service-design.md` §7、§8、§9、§14、§16、§17，以及 `docs/backend-node-hld.md`；机器契约与行为清单分别来自 `docs/contracts/central-dshd-openapi.yaml` 和 `docs/contracts/central-dshd-conformance.md`；只读 Harness 输入依据 `docs/dsh/harness-version-baseline.md`；最高目标和职责边界依据 `docs/mvp-baseline.md`。若本方案与上述基线冲突，以冻结基线为准，本方案不得成为第二套契约。

## 2. 六要素对齐与诚实边界

| 六要素 | 本方案的对齐方式 | M1 出口证据 |
| --- | --- | --- |
| 最终目标 | 建立产品工程、契约驱动链、早期镜像和四类验收资产骨架 | CI 记录、工具自检报告、镜像 smoke 记录 |
| 整体工作方法 | 契约优先，先验证生成、schema 与 runner 清单，再填充工程；fake 先于真实 Harness 集成 | DAG 与 CI job 依赖显示契约链先行 |
| 边界 | 只建骨架，不实现状态协调、进程守护、认证、代理或中央客户端业务 | runner 固定 `executed=0`；无业务通过声明 |
| 约束 | Rust 单一原生二进制；`dsh/` 只读；Node.js 24 仅供 Harness；冻结契约唯一权威 | 源码 diff、工具链记录、Harness lock 哈希核对 |
| 交付物 | 本文第 3～11 章逐项对应冻结第 5 节的 1～9 项 | 九项资产检查表 |
| 验收 | 原样落实 7 条标准和 6 步方法，不以文档审查替代可执行记录 | M1 出口记录索引全部证据 |

### 2.1 M1 不做什么

M1 不实现或验收 dshd 的配置业务规则、identity 初始化、state coordinator、lifecycle、supervisor、ready URL/cookie 认证、HTTP/WS 代理、Registry 心跳与租约、operation/idempotency 或 observability 行为；这些属于 M2～M6。M1 不实现真实中央服务，不修改 Harness，不在 `dsh/` 中开发，不完成 non-root、只读 rootfs、healthcheck 和目标 ECS 的最终收敛（属 M7），不产生 `WUI-*` parity 双证据，也不执行 66 个行为向量（属 M2～M8）。Docker skeleton 的“确定行为”只证明镜像入口能启动并以明确的骨架状态退出或响应，不证明 Harness 管理或代理正确。

## 3. 交付物 1：Cargo workspace 工程结构

### 3.1 workspace 与 crate

采用一个 Cargo workspace，建议成员为：`crates/dshd`（唯一最终二进制与依赖装配）、`crates/dshd-core`（纯领域类型、事件和端口）、`crates/dshd-contract`（冻结 OpenAPI 生成类型、schema/JCS 接线）、`crates/dshd-adapters`（文件、进程、HTTP/WS、中央客户端适配器），以及 `tools/fake-harness`、`tools/reference-stub`、`tools/conformance-runner`、`tools/capability-report` 四个独立可执行验收资产。具体目录名可在实现时等价调整，但最终只有 `dshd` 是产品运行二进制，工具不得被误装配为生产服务。

workspace 根统一 `resolver`、Rust edition、最低警告策略、依赖版本、release profile 和 lint；成员只通过 workspace dependency 继承公共版本，禁止成员用浮动 Git 分支或另建同名 DTO。`dshd-contract` 是 Registry/Management DTO 的唯一 Rust 来源；透明 `/api/**` payload 始终为 opaque stream，不进入生成 DTO。

### 3.2 模块边界映射

| 基线 §9 边界 | 落位 | M1 形态 | 后续 owner |
| --- | --- | --- | --- |
| config | `dshd-core::config` + adapter | 类型和接口占位 | M2 |
| identity | `dshd-core::identity`、文件 adapter | 端口占位 | M2 |
| state | `dshd-core::state` | 事件/snapshot 空骨架 | M2 |
| lifecycle | `dshd-core::lifecycle` | command/port 骨架 | M2/M3 |
| supervisor | adapters process | trait 与 fake 入口 | M2 |
| harness | adapters harness | ready/auth 接口占位 | M2 |
| transport | adapters transport | server/client 能力探针位置 | M3～M5 |
| proxy | adapters proxy | HTTP/WS 边界占位 | M4/M5 |
| central | adapters central | Registry client port 占位 | M6 |
| operations | core operations + file adapter | 类型占位 | M3 |
| observability | core event + adapter | sink 接口占位 | M3/M6/M7 |

依赖方向固定为 `dshd -> core/contract/adapters`、`adapters -> core/contract`，`core` 不依赖 transport 或 OS。HTTP handler 不得直接操作 child process 或持久文件。跨模块共享只能经过 typed port/event/snapshot，保持 `docs/dshd-service-design.md` §9 的单状态协调器和不可变 connection context 边界。

### 3.3 测试分层与增量演进

| 层 | 目录/执行单元 | M1 内容 | M2～M8 增量 |
| --- | --- | --- | --- |
| unit | 各 crate 内 `tests`/`mod tests` | 骨架、版本、自检的纯测试 | M2 状态/租约，M3 operation，M4/5 filter/隧道，M6 central |
| contract | `tests/contract` | OpenAPI 正反例、生成 drift、66 ID 清单 | M2～M6 逐组增加 executable adapter |
| integration | `tests/integration` | fake/stub 可启动性 | M2 真实生命周期，M3 管理，M4/5 proxy，M6 registry |
| e2e | `tests/e2e` | runner/报告入口占位，不执行行为 | M7 完成并冻结，M8 对候选 digest 执行 |

M2 在同一结构补 config/identity/state/supervisor/harness；M3 补 router/auth/management/operations；M4、M5 分别补 HTTP 与 WebSocket adapter；M6 补 central client；M7 只收敛 runtime、工具和发布证据；M8 不改工程或工具语义，只执行冻结资产。阶段 DAG 保持 `M0 → M1 → M2 → M3 → {M4,M5,M6} → M7 → M8`。

## 4. 交付物 2：工具链锁定

`rust-toolchain.toml` 必须写具体 channel 版本，不使用 `stable`、`latest` 或浮动日期，并明确最小 components（如 `rustfmt`、`clippy`）与构建 target。首次具体版本不是由本文猜定，而是在 M1 出口门禁的干净 CI 环境实际安装、编译和测试一次后记录；记录包含 `rustc -Vv`、`cargo -V`、host/target、文件摘要和 CI run 标识。以后升级必须显式修改文件并重新跑全部门禁。

`Cargo.lock` 作为二进制 workspace 的版本化输入提交，CI 所有 Cargo 命令使用 `--locked`，禁止隐式更新。发布清单生成步骤计算 lockfile SHA-256，并与 Rust 工具链记录、Harness tag/commit/tree、`dsh/pnpm-lock.yaml` 冻结摘要一起输出。M1 只建立可重复生成摘要和清单字段的机制；最终 image digest、SBOM 和兼容矩阵在 M7 收敛。该方案对齐 `docs/dshd-service-design.md` §7、§14.3 和 `docs/dsh/harness-version-baseline.md`。

## 5. 交付物 3：OpenAPI→Rust 生成链与 drift gate

### 5.1 单向生成与权威关系

流水线以 `docs/contracts/central-dshd-openapi.yaml` 为唯一输入，先运行仓库既有 `validate_contracts.py`，再由固定版本生成器输出到受管生成目录。生成物标注 generator version、输入 SHA-256 和“禁止手改”；业务 crate 只 re-export 生成类型，不复制 Registry/Management DTO 或错误枚举。10 paths、42 schemas 和 66 declared 的验证结果必须保留原口径。

生成器候选须用 fixture 验证 OpenAPI 3.1 的 `$ref`、`oneOf`/判别联合、required/nullable、format、additional properties 和 status-specific error schema。运行时 Draft 2020-12 validator 候选须真实执行 `docs/contracts/central-dshd-conformance.md` CT-06、CT-07、CT-10～CT-12 所需正反例，并确认不是退化为 Draft 7 或只做 JSON parse。JCS 使用经测试的标准 Rust 实现，禁止手写浮点和 Unicode canonicalization。

### 5.2 生成链先行验证与后备方案

在创建业务模块前先完成一份选型探针报告：固定候选版本，生成全部 schema，编译生成物，逐个跑条件 schema 正反例，并记录不支持项。只有结论成立才允许工程消费。若成熟生成器不能忠实表达冻结契约，则启用受控自定义生成器：输入仍是冻结 OpenAPI；仅为已识别的 schema 构造实现确定性映射；自身具备 golden、正反例、未知关键字 fail-closed、固定版本和输入摘要；不得人工维护第二套 DTO。后备方案的启用条件、差异和复验结果进入出口记录。

### 5.3 drift gate

CI 的 `contract-generate` job 在干净检出中生成到临时目录，与版本化生成物做字节级/规范化 diff；有差异即失败并提示先更新契约验证结论和生成物。另设负向自测，在隔离临时副本中人为修改 schema，证明 gate 必须失败，随后丢弃临时副本，绝不修改冻结契约。正常 CI 还编译生成 crate 并跑 Draft 2020-12 正反例。这样同时证明“当前无 drift”和“gate 能捕获 drift”。

## 6. 交付物 4：CI 流水线

| job | 主要命令/环境 | 依赖 | 通过定义 |
| --- | --- | --- | --- |
| contracts-source | 固定 Python + locked dependencies，执行 `validate_contracts.py` | 无 | 输出 PASS、10 paths / 42 schemas / 66 declared |
| contract-generate | 固定生成器、schema validator、生成 diff、负向 drift 自测 | contracts-source | 无 drift；人为 drift 被拒绝；生成 crate 可编译 |
| format | `cargo fmt --all -- --check` | contract-generate | 零差异 |
| clippy | `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` | contract-generate | 零 warning |
| typecheck | `cargo check --workspace --all-targets --all-features --locked` | contract-generate | 全 workspace 通过 |
| unit | `cargo test --workspace --lib --locked` | typecheck | unit 全绿 |
| contract | contract test target + 四类工具自检 | contract-generate、typecheck | schema 正反例及资产自检全绿，runner 仍 0 executed |
| docker-smoke | 构建 skeleton 并运行确定行为探针 | unit、contract | 镜像可构建、启动结果确定 |

Python 依赖用专用 lock/哈希约束安装，CI 固定 Python 版本并启用缓存但不依赖缓存正确性；命令必须调用仓库现有验证器，不能用重新实现替代。所谓“干净检出一次通过”是新 clone、无本地生成物和语言缓存，从锁定输入安装工具后，同一次 pipeline 的上述必需 job 全绿；重跑、手工预生成或缓存残留不能补救第一次失败。CI 保存工具版本、生成报告、测试结果、镜像 smoke、lock 摘要作为出口证据。

## 7. 交付物 5：Docker 双 builder skeleton

多阶段 Dockerfile 逻辑包含三个职责阶段：`dshd-builder` 使用固定 Rust 工具链和 `Cargo.lock --locked` 编译 Linux 原生 `dshd`；`harness-builder` 使用 Node.js 24、pnpm 11.7.0 与冻结 `dsh/pnpm-lock.yaml` 执行 frozen install/build；`runtime` 仅复制 dshd 二进制、Harness runtime closure、Node.js runtime、tini、util-linux flock 和必要 CA，不含 Rust/pnpm 构建工具或源码下载步骤。

骨架保持最终边界：单镜像、`tini -- dshd`、Harness 只应使用 loopback 动态端口、仅描述默认 dshd 8080 端口、运行期不下载。M1 可以暂未完成 non-root/只读 rootfs/volume/healthcheck 全部强化，这些明确留给 M7，但骨架不得采用与最终边界相反的结构。

“最小可启动到确定行为”定义为：在无业务实现时，入口二进制能以版本/骨架模式产生稳定、文档化、可断言的退出码与结构化输出，或在测试配置下提供单一明确 liveness；不得假装 READY、不得注册、不得启动真实业务代理。smoke 同时检查 runtime 有 Node.js、tini、flock、CA、冻结 Harness 闭包和 dshd 原生二进制，且没有 Rust/cargo/pnpm install 行为。

## 8. 交付物 6：fake Harness

fake Harness 是测试进程而非产品实现，提供固定版本号、`--self-test`、随机 loopback 端口和脚本化场景。正常模式向 stdout 输出与冻结 Harness 格式兼容的 authenticated ready URL；只接受 exact authority，以 launch token 换取 authority-bound cookie，并提供最小 HTTP `/api/**` 与 WebSocket `/api/remote.mux` 仿真。

故障注入使用显式 scenario 文件/参数，覆盖：ready 行分片、延迟、畸形/恶意 URL、token 拒绝、cookie authority 不匹配、probe 失败、进程退出；HTTP 慢 body、chunk、header、提交前断开、提交后断开、backpressure；WS upgrade 失败、subprotocol/extensions 不匹配、binary/text/fragment/ping/pong/close、半关闭。每个场景有确定 seed 和期望 transcript，自检只验证 fake 自身，不计为 66 向量执行。M2+ 用 adapter 把场景映射到相应向量。

## 9. 交付物 7：中央 reference stub

reference stub 同时包含两种方向、共享一份版本化状态模型：其 Registry server 接收 dshd 发起的 register、heartbeat、deregister；其 Management/Proxy client 反向调用 dshd 的 status、live/local/ready、start/stop/restart、operation、透明 `/api/**` 和 `/api/remote.mux`。接口面必须与 OpenAPI 10 paths及规范定义的 HTTP/WS 代理面闭合，不额外定义中央产品 API。

stub 支持确定性 lease/sequence、延迟/丢包/乱序、401/403/409/422、STALE/FENCED、reverse-ready、流中断和 WS close 注入，保存脱敏 transcript。M1 只提供路由、fixture、版本与 `--self-test` 骨架，所有业务 handler 可明确返回 NOT_IMPLEMENTED；M2～M6 逐步替换为行为 driver，M7 完成并冻结。它是后端独立验收强制依赖，真实中央服务联调不能替代它。

## 10. 交付物 8：66-vector runner 骨架

runner 从单一 manifest 枚举以下全部稳定 ID：`ID-01..04`、`CF-01..04`、`ST-01..14`、`PX-01..13`、`SR-01..13`、`CT-01..15`、`PV-01..03`，合计 66。manifest 每项包含 ID、规范引用、阶段 owner、driver 名称、状态 `DECLARED|EXECUTABLE` 和证据位置；M1 所有项均为 `DECLARED`。

默认运行和 JSON/JUnit 报告必须同时输出 `declared=66, executed=0, passed=0, failed=0`，退出成功只表示清单完整与 runner 自检通过，不得写成行为通过。自检验证无重复、无缺失、分组计数为 4/4/14/13/13/15/3、规范 ID 精确匹配、未知状态失败。runner 有独立语义版本和 manifest 摘要；M2 补 ID/CF/ST 基础，M3 补管理 CT/ST，M4 补 HTTP PX，M5 补 WS PX，M6 补 Registry/lease/cross-interface；M7 完成冻结，M8 只执行。

## 11. 交付物 9：能力覆盖报告工具

报告工具以稳定能力 ID 为主键，不以页面或测试文件名为主键。建议记录：`capability_id`、kind（`WUI|DSHD|OUT`）、冻结来源摘要、owner milestone、inventory_contract evidence、parity_e2e evidence、status、artifact digest、environment、tool version。`WUI-*` 在 M8 必须同时具备 inventory contract 与 parity E2E 两份成功证据；`DSHD-*` 记录外围节点证据；`OUT-*` 只能显示明确排除，不能算覆盖成功。

M1 只建立 schema、空报告、fixture 和 `--self-test`，不得生成虚假覆盖率。工具校验未知/重复 ID、证据缺一、artifact digest 不一致、环境不匹配，输出 machine JSON 与 human Markdown；二者由同一中间模型生成。能力报告与 66-vector 报告是两个维度，禁止相互替代。M4/M5 开始积累 `WUI-*` 证据，M7 冻结工具，M8 汇总同一候选 digest 的双证据。

## 12. 风险与对策

| 风险 | M1 对策 | 后续关闭点 |
| --- | --- | --- |
| OpenAPI→Rust / Draft 2020-12 生态不完整 | 先行探针、正反例、受控生成器后备、fail closed | M1 必须形成结论 |
| Rust HTTP trailer/abort/partial response 差异 | M1 只做栈能力探针和 fake 故障接口，不宣称代理实现 | M4 PX-08、PX-11～13 |
| Upgrade head、半关闭、backpressure 错误 | 保留 raw socket adapter 边界，fake 提供逐帧/断连场景 | M5 PX-09/10 |
| `flock --no-fork` runtime 差异 | skeleton 固定并可检查工具，预留 PID/signal smoke | M2/M7 E2E |
| Harness developer preview 漂移 | 固定 tag/commit/tree/lock 哈希，`dsh/` 零修改 | 每次构建与升级门禁 |
| ID 数量被误报为通过 | runner 强制 executed 分栏并在 M1 固定为 0 | 所有阶段报告审查 |
| 测试资产语义漂移 | 每项独立版本、manifest 摘要、自检、M7 冻结 | M7/M8 |
| 目标 ECS 前提未知 | M1 不臆测容量或声称环境合格 | M7 冻结环境并预检 |

## 13. M1 出口证据包

出口记录只索引真实机器产物：干净 CI run、契约 validator 报告、生成链选型与 drift 正/负证明、四类资产版本和自检、66 ID 清单与 `executed=0` 报告、Docker build/smoke、Rust 版本、`Cargo.lock` 与 Harness lock 摘要、`dsh/` 零 diff。记录还列出未实现项和 M2 接口，不把骨架可运行解释为产品行为可用。

