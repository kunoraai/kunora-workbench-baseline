# T08 Reconcile 证据

`dshd-core::state` 的 reducer 测试覆盖：probe 成功后才发布 generation；旧 attempt 的迟到认证被丢弃；shutdown 优先并阻止 READY 复活；desired STOPPED 先持久化再产生 Stop effect。退避为 1/2/4 秒并封顶 30 秒。

ST-05 模型链：READY → child exit → DropContext/UNHEALTHY → backoff → 新 attempt → READY generation N+1。ST-06/11/13/14 的本地优先级由 typed Event/Effect 单 reducer 收敛。
