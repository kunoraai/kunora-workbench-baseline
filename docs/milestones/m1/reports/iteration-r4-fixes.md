# M1 实现迭代 4 修复记录

## 范围

本轮修复 `reference-stub --self-test` 在 Windows 回环连接上因 WSA 10004、10053、10061 等瞬时错误发生恐慌或线程关闭撕裂的问题，并对具有相同阻塞 socket 模式的 `fake-harness --self-test` 做同类加固。ROUTES 仍是 reference stub 的唯一路由来源，13 条路由逐条真实探测；一致性向量仍保持 `declared=66, executed=0` 的诚实边界。

## 实现

- reference stub 对每条路由执行最多三次连接级尝试，瞬时错误之间采用 25/50 毫秒短退避；非瞬时错误或重试耗尽均返回非零。
- 客户端按 HTTP `Content-Length` 判断响应完整，不依赖连接 EOF，避免 Windows 在完整响应后报告 connection reset 时把成功探测误判为失败。
- 服务端 listener 使用非阻塞接受循环，并在全部客户端探测结束后通过进程内完成信号退出；客户端随后 join 服务端线程，不通过关闭另一线程正在阻塞的 socket 结束服务。
- self-test 的 bind、accept、connect、read、write、shutdown 与线程结果均显式传播；不再对瞬时 IO 使用 `unwrap` 或 `expect`。
- fake harness 同样采用三次有界重试、完整响应判定、完成信号和显式错误传播，保留原有认证、authority cookie、成功探测和拒绝探测语义。

## 保持项

- reference stub 输出继续包含 `route_probe=13/13 PASS` 与 `behavior=NOT_IMPLEMENTED vectors_executed=0`。
- fake harness 输出继续包含 ready loopback URL、HTTP probe、authority cookie、fixture 和 `ws=NOT_IMPLEMENTED vectors_executed=0`。
- 未实现任何 M1 诚实边界之外的后端行为，未修改冻结契约、review、验收器或产品实现。

## 验收

以下门禁在本轮提交前逐项运行，结果均须为 `RESULT=PASS`：

1. `node tools/check-m1-impl-r4.mjs --mode structural --baseline f129fb1235206e513e6979b545837acef9b7c664 --six 0bcf8ee7d5de7df240ae5ed380f4f819a32f664537104a8f370b0b209435bd1f --plan 78412554c9d54d9e489b74d211a2a6f5723d2b728a4fd20328e6dec173e2f5b3 --dplan d830c97968fe33fd330f4bdbca17d68a48f971f7cbadec6227bceb10ab0ff043`
2. `node tools/check-m1-impl-r4.mjs --mode cargo-check`
3. `node tools/check-m1-impl-r4.mjs --mode cargo-test`
4. `node tools/check-m1-impl-r4.mjs --mode drift-real`
5. `node tools/check-m1-impl-r4.mjs --mode selftests-real`
