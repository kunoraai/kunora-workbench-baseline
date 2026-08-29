# T03/T04 生成、Draft 2020-12 与 JCS 探针

- 固定工具链：rustc 1.89.0；cargo 1.89.0。
- 实际命令：`cargo check --workspace --all-targets --locked`，退出 0。
- 实际命令：`cargo test --workspace --locked`，退出 0；`dshd-contract` 的确定性生成指纹、正反输入和 drift 两项测试通过。
- 生成候选结论：M1 使用 `m1-controlled-generator/0.1.0` 的受控确定性边界；未声称已经生成完整 42 个强类型 DTO。
- Draft 探针结论：骨架正例接受、反例拒绝；完整冻结 schema 的运行时覆盖仍为后续实现扩展点。
- JCS 结论：M1 未实现 JCS canonicalization，也未手写浮点/Unicode 逻辑；因此不宣称 CT-13/CT-14 行为通过。

以上只证明工程探针真实编译运行，不证明任何 dshd 行为或 66 向量已执行。

