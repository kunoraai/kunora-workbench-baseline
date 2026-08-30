# M2 实现迭代 3 修复记录

日期：2026-08-29。范围仅 R2-1；`declared=66` 未改变。

- `dshd` main 按 config→identity→desired→guard→coordinator→supervisor 顺序装配；invalid config/identity 与 guard 冲突仍在任何 Harness 副作用前失败。
- coordinator effect executor 改为异步 feedback channel；supervisor 真实执行 Spawn、Bootstrap、ScheduleBackoff、Stop，并监视 OS child exit。
- 修复产品缺陷：Harness stdin 必须为 null，避免与 dshd typed-command stdin 竞争；ready stdout 使用有界分片读取；HTTP header 名按协议大小写不敏感；真实 probe 改为冻结 Harness 的 `POST /api/settings/describe` RPC。
- Windows stop 先尝试 `taskkill /T /F`，再对精确 child handle 强制终止并 wait；外层 crash 注入同样以精确 PID 存活检查为准，不接受 `tasklist` Access denied 的假阴性。
- 产品 run exit=0：PID 18956→17444、generation 1→2、两代 exchange=303/probe=HTTP_200、crash→1000ms backoff→N+1、typed shutdown→STOPPED。见 `t14-real-harness.md`。
- 未实现范围保持不变：中央注册/租约、管理 API、透明 HTTP/WS proxy。
