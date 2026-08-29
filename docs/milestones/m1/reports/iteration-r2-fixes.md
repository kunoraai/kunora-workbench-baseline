# M1 独立验收 R1 修复记录（R2）

本记录只索引实际实现和本地机器复跑，不把 M1 骨架或 66 项声明冒充产品行为执行。

| 发现 | 处置 | 证据 |
| --- | --- | --- |
| F01/F03 | 新增固定版本受控 `contract-gen`，确定性生成 42 个 schema Rust 类型，写入 generator 版本与输入 SHA-256；check 比较受管输出。 | `cargo run --locked -p contract-gen -- --check`；`drift-real` 正负门 |
| F02 | 接入 `jsonschema` Draft 2020-12 和 `jcs`，增加正反验证与 RFC 8785 风格测试向量探针。 | `cargo test -p dshd-contract --locked` |
| F04/F05 | manifest 逐行列出 66 ID 和元数据；runner 从文件加载并校验精确集合、分组、状态，支持覆盖路径及 text/JSON/JUnit。 | runner self-test；损毁副本负测；始终 `declared=66, executed=0` |
| F06 | fake Harness 自检真实绑定随机 loopback，执行 token/cookie/authority 与 `/api/probe`，拒绝坏 token；WS 明确 NOT_IMPLEMENTED。 | self-test 动态 ready URL 与 probe 结果 |
| F07 | reference stub 自检启动 Registry loopback server，由 client 真实请求 register/heartbeat/deregister；未知路由 501。 | self-test 动态 Registry URL |
| F08 | 34 项 capability inventory 以 ID 为键；校验精确分组、重复/未知及 WUI 双证据规则；JSON/Markdown 同模型。 | capability self-test 与损毁副本负测；covered=0 |
| F09 | CI 拆分八个独立 jobs。 | `.github/workflows/m1.yml` |
| F10 | builder 构造并校验 runtime closure，runtime 仅复制 closure。 | `Dockerfile`（本机无 Docker，保持 PENDING） |
| F11 | 固定 Linux target。 | `rust-toolchain.toml` |
| F12 | AC-02 引用真实 check/负测；保留 CI/Docker 外部证据 PENDING。 | `exit-record.md` |

最终证据以五模式机械验收原始输出为准；远端 CI 与 Docker 没有本机证据，不声明 PASS。
