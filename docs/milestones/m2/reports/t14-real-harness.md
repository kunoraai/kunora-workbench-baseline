# T14 冻结真实 Harness 机器证据（R4）

## 固定输入与证据来源

- Windows VPS（非管理员），Node `24.19.0`，Corepack 按 `packageManager=pnpm@11.7.0` 建立临时 shim。
- 干净 detached worktree：提交 `2f03dbe`；运行前 `git status --short` 为空；路径 `msys64/tmp/r4clean-2f03dbe`。
- `corepack pnpm install --frozen-lockfile` 后执行 `corepack pnpm build`，均 exit=0；未修改冻结 `dsh/` 源码。
- `pnpm-lock.yaml` SHA-256：`506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`。
- 新临时 `HOME`/`USERPROFILE`/XDG/DSH 状态目录由脚本创建并在结束清理；不复用原工作树状态。
- 构建入口 `dsh/apps/cli/lib/bin.js` SHA-256：`dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166`。
- 固定 profile：`dsh web --no-open --port 0`；脚本随后 `cargo build --locked -p dshd` 并启动 dshd 产品路径。

## 2026-08-30 干净检出脱敏 transcript

```text
000284ms PREPARE frozen_install=corepack-pnpm frozen_lock=true
042262ms PREPARE cli_build=pnpm-build
439167ms PREPARE cli_artifact=.../dsh/apps/cli/lib/bin.js sha256=dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166
514735ms PRODUCT_START driver=dshd-assembled profile="dsh web --no-open --port 0" cli_sha256=dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166
515068ms DSHD observed=Running guard=HELD pid=13940
515083ms DSHD effect=Spawn attempt=1 child_pid=2044
521645ms DSHD event=ready-url attempt=1 child_pid=2044 authority=127.0.0.1:<dynamic> token=REDACTED
521647ms DSHD observed=Authenticating attempt=1 generation=0
521744ms DSHD effect=Bootstrap attempt=1 exchange=303 probe=HTTP_200 cookie=REDACTED
521749ms DSHD observed=Ready attempt=1 generation=1 authority=127.0.0.1:<dynamic>
521796ms INJECT_CRASH generation=1 pid=2044 method=taskkill-/T-/F
526871ms CRASH_CONFIRMED generation=1 pid=2044 pid_gone=true injector_exit=1
526938ms DSHD event=child-exited attempt=1 child_pid=2044
526938ms DSHD effect=ScheduleBackoff attempt=1 delay_ms=1000
526954ms DSHD observed=Unhealthy attempt=1 generation=1 authority=none
527947ms DSHD effect=Spawn attempt=2 child_pid=12244
533975ms DSHD event=ready-url attempt=2 child_pid=12244 authority=127.0.0.1:<dynamic> token=REDACTED
533983ms DSHD observed=Authenticating attempt=2 generation=1
534057ms DSHD effect=Bootstrap attempt=2 exchange=303 probe=HTTP_200 cookie=REDACTED
534065ms DSHD observed=Ready attempt=2 generation=2 authority=127.0.0.1:<dynamic>
534110ms PRODUCT_SHUTDOWN signal=typed-internal-command windows_SIGTERM_semantics=graceful
534112ms DSHD effect=Stop attempt=2 phase=graceful-terminate stop_timeout_ms=8000
534127ms DSHD observed=Stopping attempt=2 generation=2 authority=none
542118ms DSHD effect=Stop attempt=2 phase=timeout-force-kill
542187ms DSHD event=child-exited attempt=2 child_pid=12244
542202ms DSHD observed=Stopped attempt=0 generation=2 authority=none
542208ms PRODUCT_STOPPED generation=2 pid=12244 pid_gone=true
RESULT=PASS driver=dshd-assembled generations=1,2 pids=2044,12244 real_probe=HTTP_200 secrets=REDACTED
```

## 判定

AC-03/VM-03 PASS：证据来自包含可重复依赖安装和 CLI 构建的干净检出，而非历史产物。dshd 装配路径真实驱动两代不同 PID，先后完成 exchange=303、probe=HTTP_200 与 generation 1→2；第一代 crash 后执行 1000ms backoff。第二代关闭先投递 graceful tree termination，8 秒窗口届满后升级 force kill，并在约 8.1 秒内发布 STOPPED，最终 PID 消失。
