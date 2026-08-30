# T04 Writer guard 机器证据

UTC 日期：2026-08-30；环境：Windows x64；命令：同一 state-dir 启动两个 `target/debug/dshd.exe` OS 进程。

- owner PID：17396，输出 `guard=HELD`，保持运行 3000ms。
- competitor PID：11044，exit=1，stderr=`WRITER_GUARD_HELD`。
- competitor 在 guard 失败后退出，未进入 supervisor/spawn 路径。
- RAII owner 结束后 lock 文件释放；adapter 单元反例再次取得成功。

CF-01 本地双进程 oracle：PASS。
