# T14 冻结真实 Harness 机器证据

## 固定输入与证据来源

- Windows VPS（非管理员），Node `24.19.0`，pnpm `11.7.0`；`corepack pnpm@11.7.0 install --frozen-lockfile` exit=0。
- `pnpm-lock.yaml` SHA-256：`506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`；`dsh/` tracked diff 为零。
- 固定 profile：`dsh web --no-open --port 0`。
- 命令：`cargo build -p dshd --locked` 后执行 `node scripts/run-m2-real-harness.mjs`，exit=0。
- 证据明确来自 **dshd 装配路径**，由 dshd 驱动 coordinator、supervisor 与 `Spawn/Bootstrap/ScheduleBackoff/Stop` effects；外层脚本只启动产品、观察产品日志并注入第一代 PID crash，不调用 reducer 或自行启动 N+1。

## 2026-08-29 dshd 驱动脱敏 transcript

```text
00000ms PRODUCT_START driver=dshd-assembled profile="dsh web --no-open --port 0"
00323ms DSHD effect=Spawn attempt=1 child_pid=18956
07374ms DSHD ready-url attempt=1 child_pid=18956 authority=127.0.0.1:<dynamic> token=REDACTED
07380ms DSHD observed=Authenticating attempt=1 generation=0
07482ms DSHD effect=Bootstrap attempt=1 exchange=303 probe=HTTP_200 cookie=REDACTED
07502ms DSHD observed=Ready attempt=1 generation=1 authority=127.0.0.1:<dynamic>
07542ms INJECT_CRASH generation=1 pid=18956 method=taskkill-/T-/F
12630ms CRASH_CONFIRMED generation=1 pid=18956 pid_gone=true injector_exit=1
12729ms DSHD event=child-exited attempt=1 child_pid=18956
12729ms DSHD effect=ScheduleBackoff attempt=1 delay_ms=1000
12747ms DSHD observed=Unhealthy attempt=1 generation=1 authority=none
13740ms DSHD effect=Spawn attempt=2 child_pid=17444
20645ms DSHD ready-url attempt=2 child_pid=17444 authority=127.0.0.1:<dynamic> token=REDACTED
20651ms DSHD observed=Authenticating attempt=2 generation=1
20759ms DSHD effect=Bootstrap attempt=2 exchange=303 probe=HTTP_200 cookie=REDACTED
20773ms DSHD observed=Ready attempt=2 generation=2 authority=127.0.0.1:<dynamic>
20774ms PRODUCT_SHUTDOWN signal=typed-internal-command windows_SIGTERM_semantics=graceful
20794ms DSHD observed=Stopping attempt=2 generation=2 authority=none
25919ms DSHD event=child-exited attempt=2 child_pid=17444
25919ms DSHD observed=Stopped attempt=0 generation=2 authority=none
25926ms PRODUCT_STOPPED generation=2 pid=17444 pid_gone=true
RESULT=PASS driver=dshd-assembled generations=1,2 pids=18956,17444 real_probe=HTTP_200 secrets=REDACTED
```

## Windows 终止语义

本 VPS 的 `taskkill /T /F` 对第一代返回 exit=1/Access denied，故外层注入器随后对精确 PID 使用 Windows `TerminateProcess`（Node `SIGKILL` 等价）并以 `kill(pid, 0)` 失败确认 PID 消失；dshd 随后自行观察 `ChildExited`。优雅关闭通过 M2 typed internal command 注入 `Shutdown`，语义等价于产品 SIGTERM handler 的 reducer 输入；dshd 执行 Stop effect，先进入 STOPPING，再在有界等待内杀死进程树并发布 STOPPED。这里不把 Windows 不存在的 POSIX signal 投递冒充原生 SIGTERM。

## 判定

AC-03/VM-03 PASS：这是 dshd 装配产品路径的真实 N+1 transcript，不是诊断 driver、fake 或 reducer 证据。旧 generation 在 crash 后先撤销，第二代真实认证/probe 后才发布 generation 2；两代 PID 不同且最终均消失。
