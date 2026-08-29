# T01 冻结输入核验记录

- 时间：2026-08-29（America/Los_Angeles）
- 基线：`85be9517bb4315e5479184ac0917ad8baeae892a`
- 命令：`Get-FileHash -Algorithm SHA256 <冻结输入>`、`git status --short`
- 结果：冻结三文档 SHA-256 分别为 `0bcf8ee7...35bd1f`、`78412554...e2f5b3`、`d830c979...0ff043`，与验收器输入一致。
- OpenAPI SHA-256：`3ca99340...52a811`；conformance SHA-256：`0399a40b...eee70`。
- 初始工作区仅 `?? PROMPT.md`；`dsh/` 与 `docs/contracts/` 未修改。
- 仓库验证器的冻结口径为 10 paths / 42 schemas / 66 declared；本机首次执行因 Python 依赖未安装失败，随后依赖安装工作独立处理，不伪造 PASS。

