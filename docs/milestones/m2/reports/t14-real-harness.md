# T14 冻结真实 Harness 机器证据

## 固定输入

- Windows VPS（非管理员），Node `24.19.0`，pnpm `11.7.0`。
- `corepack pnpm@11.7.0 install --frozen-lockfile` exit=0。
- `pnpm-lock.yaml` SHA-256：`506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`。
- 固定 profile：`dsh web --no-open --port 0`。
- 命令：`node scripts/run-m2-real-harness.mjs`；exit=0；临时 DSH_HOME/agents 目录已清理。
- `dsh/` 零 tracked diff；依赖与构建产物均为 ignored 文件。

## 2026-08-29 脱敏诊断 transcript

```text
00000ms STARTING generation=1 profile="dsh web --no-open --port 0"
07377ms AUTHENTICATING generation=1 pid=6800 authority=127.0.0.1:<dynamic>
07563ms READY generation=1 pid=6800 exchange=303 cookie_count=1
07564ms probe_status=HTTP_200 generation=1 rpc=server-response
17726ms CRASHED generation=1 pid=6800 pid_gone=true method=taskkill-/T-/F taskkill_exit=1
17726ms BACKOFF delay=1000ms
18732ms STARTING generation=2
26032ms AUTHENTICATING generation=2 pid=10440 authority=127.0.0.1:<dynamic>
26139ms READY generation=2 pid=10440 exchange=303 cookie_count=1
26139ms probe_status=HTTP_200 generation=2 rpc=server-response
31219ms STOPPED generation=2 pid=10440 pid_gone=true signal=SIGTERM
RESULT=PASS generations=1,2 real_probe=HTTP_200 secrets=REDACTED
```

Windows 说明：`taskkill /PID 6800 /T /F` 返回 exit=1/Access denied，但随后 `tasklist /FI "PID eq 6800" /NH` 确认目标 PID 消失；旧监听随之撤回。该 VPS 上 `/T` 会因进程树中的辅助进程返回拒绝，故以目标 Harness PID 消失作为 crash 判据。第二代以 Node 的 Windows `SIGTERM` 等价终止，PID 在有界等待内消失。

## 判定边界

真实 Harness 本身的两代启动、认证、probe、强制终止、等待和停止诊断链为 PASS，且两代 PID 与 generation 递增证据齐全。但该 transcript 由诊断 driver 编排；当前 `crates/dshd/src/main.rs` 未调用 `dshd_adapters::supervisor`，也没有执行 reducer 的 `Spawn/Bootstrap/ScheduleBackoff` effects。因此它不能证明 **dshd 自动检测 crash 并恢复**。

AC-03/VM-03 继续如实标为 BLOCKED。具体产品阻塞：supervisor/effect executor 尚未装配进 dshd 运行路径；下一步必须在不改变冻结契约的前提下完成该装配，再用同一固定快照重跑一次由 dshd 驱动的完整 transcript。fake、unit 或本诊断 driver 均不得替代该证据。
