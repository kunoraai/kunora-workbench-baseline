# M2 实现迭代 2 修复记录

日期：2026-08-29。范围仅为 R1-1～R1-3；`declared=66` 未改变。

## R1-1（D6/AC-03）

- frozen lock 安装 exit=0；锁摘要保持 `506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`；`dsh/` 零 tracked diff。
- `node scripts/run-m2-real-harness.mjs` exit=0，真实 PID 6800→10440、generation 1→2、两代 exchange/probe 成功、1 秒 backoff、末代 SIGTERM→PID 消失。完整脱敏时间线见 `t14-real-harness.md`。
- Windows `taskkill /T /F` 返回 exit=1/Access denied，但目标 PID 经 `tasklist` 确认消失。诊断 driver 使用目标 PID 消失作为等价 crash 判据。
- 结论：环境和真实 Harness 可跑通两代链；产品路径仍 BLOCKED。`dshd` main 未装配 supervisor/effect executor，诊断 driver 结果不能冒充 dshd 自动恢复。下一步为完成产品装配后重跑同一证据链。

## R1-2（D7）

- fake-harness 与 reference-stub 将 `UnexpectedEof` 纳入 Windows 瞬时 I/O 分类，维持最多 3 次、25/50ms 退避。
- fake-harness 改为完整读取请求头，并对请求/响应施加 16 KiB 上限；响应继续按 `Content-Length` 判断完整，瞬时 I/O 不 unwrap。
- 两工具新增“部分响应不完整”和“UnexpectedEof 可重试”单元测试。
- 定向单测：4/4 PASS；随后 fake/stub 交替连续 4 轮自检均 PASS（fake 4/4，stub 4/4）。

## R1-3（selftests-real 稳定性）

- Windows 本机额外压力复跑 fake/stub 各 4 次，全绿；验收器自身的各连续 2 次门将在最终七模式中再次执行。
- 重试仍严格有界，无无界 timeout 或随机放行。
