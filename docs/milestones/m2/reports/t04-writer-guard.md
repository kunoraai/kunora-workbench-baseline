# T04 Writer guard 机器证据（R4）

Writer guard 已从 `create_new` 哨兵改为 `fs4::FileExt::try_lock_exclusive`，在 Windows 使用 `LockFileEx`、Unix 使用 `flock`，所有权绑定 RAII 文件 handle。锁文件可以保留诊断 PID，但它的存在不表示锁被占用；进程崩溃关闭 handle 后，successor 可立即取得内核锁。

覆盖项：同一 state-dir 的 owner/competitor 排他（竞争者为 `WRITER_GUARD_HELD`）、RAII 释放后 successor 取得、预存 stale `writer.lock` 不阻塞 successor。guard 在 coordinator/supervisor 之前取得，因此 competitor 失败路径不会 spawn child，也不会发布 local/ready。

CF-01 本地双进程 oracle：PASS。Windows 与 Unix 共用相同公开 adapter 行为，底层由 fs4 分别映射到对应 OS 内核锁。
