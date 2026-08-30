# T04 Writer guard 机器证据（迭代 4）

Writer guard 已由 `create_new` 哨兵文件改为 `fs4` 封装的 OS 内核排他锁（Windows `LockFileEx`，Unix `flock`），锁的所有权与 RAII `File` handle 绑定。`writer.lock` 只是稳定锁定 inode/path，其存在不代表锁被占用；owner 正常退出、panic 或异常进程终止后，内核释放 handle 所持锁，successor 可重新取得。

本地 oracle 覆盖：

- owner 持锁期间 competitor 取得失败，并映射为 `WRITER_GUARD_HELD`；competitor 在 guard 前置门失败，不进入 coordinator/supervisor，因而无 child/local-ready 副作用。
- owner handle 释放后 successor 取得成功。
- 预先存在的 stale `writer.lock` 不阻塞 successor，证明判据来自内核锁所有权而非哨兵文件存在性。

CF-01 的 Windows/Unix 实现共用同一 RAII 语义；当前 Windows VPS 复跑由 cargo test 与产品路径 guard 门验证。
