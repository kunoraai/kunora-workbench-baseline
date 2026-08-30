# T15 Runner 诚实计数

manifest 保持 `declared=66`；本次 `executed=4`、`passed=4`、`failed=0`。提升条目为 ID-01、ID-02、CF-01、ST-06；其他 62 条保持 declared。

JSON、JUnit、人读输出均由运行时读取 manifest 动态计算；损坏 ID 的 M1/M2 负向门禁必须非零退出。unit 覆盖本身不提升 executed；M2 driver 标签为 `m2-local`。
