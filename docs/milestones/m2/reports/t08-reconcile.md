# T08 Reconcile 证据

`dshd-core::state` 的 reducer 测试覆盖：probe 成功后才发布 generation；旧 attempt 的迟到认证被丢弃；shutdown 优先并阻止 READY 复活；desired STOPPED 先持久化再产生 Stop effect。退避为 1/2/4 秒并封顶 30 秒。

ST-05 模型链：READY → child exit → DropContext/UNHEALTHY → backoff → 新 attempt → READY generation N+1。ST-06/11/13/14 的本地优先级由 typed Event/Effect 单 reducer 收敛。

迭代 5 增加两种确定顺序：`child-gone-before-stop-event` 先进入 UNHEALTHY，收到 shutdown 后由幂等 Stop acknowledgement 收敛；`stop-event-before-child-gone` 在 Stopping 收到 ChildExited 后直接收敛 STOPPED。重复 shutdown 不再重复产生 Stop effect，hold deadline 入口也只投递一次。

Windows owner 自动 shutdown 实测：owner PID 17244 先以 child PID 17580 达到 READY；`Stop-Process -Force` 确认第一代在 hold deadline 前消失，随后恢复 child PID 18428、generation 2；deadline 触发 graceful→8000ms→force，snapshot sequence 最大为 12，发布 Stopped 后 owner exit=0。该次运行没有 R2 所见的 shutdown/stop 队列风暴。
