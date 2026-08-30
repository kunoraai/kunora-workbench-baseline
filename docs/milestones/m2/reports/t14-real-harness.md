# T14 冻结真实 Harness 机器证据

- Node `24.19.0`，pnpm `11.7.0`，frozen lock 安装 exit=0。
- `pnpm-lock.yaml` SHA-256：`506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`。
- 固定 profile：`dsh web --no-open --port 0`。
- 真实进程 PID：13416；脱敏 authority：`127.0.0.1:65128`。
- 状态序列：STARTING → AUTHENTICATING → authenticated probe HTTP 200 → READY generation=1。
- token exchange HTTP 200；cookie_count=1；token/cookie 未写入本报告。
- 源码快照 git diff：零 tracked diff；构建产物和依赖均为 ignored 文件。

真实 happy path：PASS。真实 crash→backoff→READY N+1 尚未形成单次完整 transcript，故 AC-03 该子项为 BLOCKED，不能用 fake/reducer 证据替代。
