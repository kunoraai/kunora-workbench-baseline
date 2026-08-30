# 修订记录

| 版本 | 日期 | 作者 | 修订内容 | 验收依据 |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-08-30 | 用户（人类验收人） | M1「工程与验收基础」里程碑人工验收通过。 | [M1 交付简报](briefing/m1-briefing.html)、[独立验收报告 R3](reviews/acceptance-r3.md)、五模式机械验收、遗留事项口径 |

# M1「工程与验收基础」人工验收记录

## 1. 验收结论

**M1 验收通过（2026-08-30，用户明确指令）。**

依据：
1. HTML 交付简报 `docs/milestones/m1/briefing/m1-briefing.html`（用户已确认收到并打开）；
2. 独立验收报告 R3 `docs/milestones/m1/reviews/acceptance-r3.md`：四维度全 PASS（阶段目标达成/交付物与计划符合度/代码评审/真实测试复跑），结论“通过独立验收”；
3. 调用方独立复跑五模式机械验收（structural/cargo-check/cargo-test/drift-real/selftests-real）5/5 PASS，含真负向门（损毁生成物/manifest/inventory 必失败）与 reference-stub 连续 3 次稳定性门；
4. 三轮独立评审（R1/R2/R3）共 15 项发现全部闭环。

## 2. 验收时的状态口径

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 里程碑提交 | `main = 0f629994a`（含 M1 全部实现与验收记录） | 已推 origin/main |
| 66 向量 | `declared=66, executed=0` | 诚实边界保持 |
| AC-01/VM-01 | BLOCKED-EXTERNAL → 转正中 | 用户已增加 GitHub Actions 预算；CI 证据补齐后由 BLOCKED-EXTERNAL 转 PASS（见第 4 节） |
| AC-04/VM-04（Docker） | PENDING | 随 CI 恢复由 docker-smoke job 补齐运行证据 |
| `dsh/` 与冻结契约 | 零改动 | 冻结边界保持 |

## 3. 验收通过的效力

按七步协议，M1 步骤 7（人工验收）已满足，M1 正式关闭；下一里程碑 M2「进程与认证」（[路线图 §17.2](../../dshd-service-design.md)）获准启动。M2 六要素冻结文档见 `docs/milestones/m2/six-elements.md`。

## 4. 遗留事项追踪

1. **CI 证据补齐（状态更新）**：2026-08-30 依用户决定将仓库转为 public（`gh repo edit --visibility public`），Actions 已能创建 run 并真实调度，但全部 job 在 runner 预置阶段被拒（conclusion=failure、零 step、日志为空）——已确认为组织账户付款方式失效/限额类阻断（同 [GitHub 社区 164954/187302 症状]，与代码无关）。期间调用方本地复现并修复两个真实问题：① `human-acceptance.md` 断链（`../`→`../../`，致 contracts-source 验证失败）；② `contract-gen` collapsible_if clippy 缺陷（迭代 3 遗留，五模式验收未含 clippy 门禁）。修复提交 `5f82f06c` 本地全绿（fmt/clippy/check/test/drift-real/selftests-real/validate_contracts）。待账户侧修复付款方式后，CI 8 job 全绿即固化 AC-01/VM-01（BLOCKED-EXTERNAL→PASS）与 AC-04/VM-04/D5（PENDING→PASS）证据。
2. 上述证据为 M1 出口的补强项，不改变 M1 已通过的验收结论。用户已决定暂搁置 CI 补齐、先行推进 M2（2026-08-30）。

## 5. 诚实声明

本记录是**人类验收决定记录**，不是新一轮独立验收报告；验收判断依据为上述已冻结评审与机械验收证据，未新增任何测试数据。
