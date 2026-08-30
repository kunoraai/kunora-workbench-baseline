# T01 冻结输入与 M1 接口审计

- 基线 commit：`8bc882960b3a5a881dff17c4ed023174d1e34df1`
- Rust/Cargo：`1.89.0`；Node：`24.19.0`；Harness pnpm：`11.7.0`
- Cargo.lock SHA-256：`F091069863A575E0F7B2E09A70C20F9F631DB36CE2B07BD6F5C22A286EC932C`
- Harness lock SHA-256：`506AD1FC7C40F71CE8C6AFE08724FDD55020C1A527D7A7A185C559D39ECFCAF1`
- Harness：tag `dsh-v0.1.2-alpha.1`，commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`，tree `a712eec535b48badc4fefb4df5176a7002e4280b`。
- 向量：ID 4、CF 4、ST 14、PX 13、SR 13、CT 15、PV 3，总数 66。
- M2 仅提升 ID-01、ID-02、CF-01、ST-06 的本地 driver；中央/管理/代理依赖保持 declared。

结论：冻结摘要一致，`dsh/`、契约、M1 文档未修改。
