#!/usr/bin/env node
// M1 独立验收评审（m1-accept-r1）机械验收器 —— 冻结于基线提交。
// 用法：node tools/check-m1-accept-r1.mjs --baseline <40hex>
// 校验评审报告的结构完备性；退出码 0 且 RESULT=PASS 为通过。
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) {
    console.log(`RESULT=FAIL REASON=missing-arg ${name}`);
    process.exit(1);
  }
  return args[i + 1];
}
const baseline = argOf('--baseline');
const REPORT = 'docs/milestones/m1/reviews/acceptance-r1.md';
const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
};
function git(...rest) {
  return execFileSync('git', rest, { encoding: 'utf8' }).trim();
}
function blobSha(rev, path) {
  return createHash('sha256').update(execFileSync('git', ['show', `${rev}:${path}`])).digest('hex');
}

// 1. 工作区干净（仅未跟踪 PROMPT.md）
const status = git('status', '--porcelain').split('\n').filter(Boolean);
ok('worktree-clean', status.every((l) => l === '?? PROMPT.md'), `status=[${status.join(' | ')}]`);
// 2. 恰好一次提交、身份
const count = git('rev-list', '--count', `${baseline}..HEAD`);
ok('commit-count', count === '1', `count=${count}`);
const author = git('log', '-1', '--format=%an <%ae>');
ok('commit-author', author === 'Remote Agent <agent@remote.kunora.ai>', `author=${author}`);
// 3. 变更白名单 = 仅评审报告
const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean);
ok('diff-whitelist', changed.length === 1 && changed[0] === REPORT, `changed=[${changed.join(', ')}]`);
// 4. 报告存在与规模
let report = '';
try {
  report = readFileSync(REPORT, 'utf8').replace(/\r\n/g, '\n');
} catch (e) {
  ok('report-readable', false, String(e.message).slice(0, 80));
}
ok('report-size', Buffer.byteLength(report, 'utf8') >= 4000, `bytes=${Buffer.byteLength(report, 'utf8')}`);
// 5. 结构：评审维度结论
const dims = ['阶段目标达成', '交付物与计划符合度', '代码评审', '真实测试复跑', '总体结论'];
for (const d of dims) {
  ok(`dim[${d}]`, report.includes(d), 'missing dimension heading');
}
// 6. 逐任务覆盖：T01..T25 每个编号出现
for (let i = 1; i <= 25; i++) {
  const id = `T${String(i).padStart(2, '0')}`;
  ok(`task[${id}]`, report.includes(id), 'missing task coverage');
}
// 7. 结论口径：每维度 PASS/CONCERNS/FAIL 之一 + 总体判定行
const verdictRe = /总体结论[：:]\s*(通过独立验收|有条件通过|未通过独立验收)/;
ok('overall-verdict', verdictRe.test(report), 'overall verdict line missing');
ok('per-dim-conclusions', (report.match(/(PASS|CONCERNS|FAIL)/g) || []).length >= 5, 'fewer than 5 dimension conclusions');
// 8. 发现条目格式（如有发现 F01 起）：维度/严重度/位置/原文/问题/建议
const fHeads = (report.match(/^### F\d{2,}/gm) || []);
ok('finding-format', report.includes('未发现') || fHeads.length === 0 || fHeads.every(() => true), 'n/a');
const sevOk = [...report.matchAll(/^### (F\d{2,})/gm)].every((m) => {
  const seg = report.slice(m.index, report.indexOf('###', m.index + 1) === -1 ? undefined : report.indexOf('###', m.index + 1));
  return ['维度', '严重度', '位置', '原文', '问题', '建议'].every((k) => seg.includes(`${k}：`));
});
ok('finding-fields', sevOk, 'each F## must contain 维度/严重度/位置/原文/问题/建议');
// 9. 复跑证据：真实命令输出摘要存在（cargo test / self-test / drift / validator）
for (const ev of ['cargo test', 'self-test', 'drift', 'validate_contracts']) {
  ok(`evidence[${ev}]`, report.includes(ev), 'missing re-run evidence mention');
}
// 10. AC-01 外部阻断口径
ok('ac01-external-blocked', report.includes('AC-01') && report.includes('BLOCKED-EXTERNAL'), 'AC-01 must be recorded as BLOCKED-EXTERNAL (billing)');
// 11. 冻结文档不可变
const frozen = ['docs/milestones/m1/six-elements.md', 'docs/milestones/m1/overall-plan.md', 'docs/milestones/m1/detailed-plan.md'];
for (const f of frozen) {
  ok(`frozen[${f}]`, blobSha(baseline, f) === blobSha('HEAD', f), 'frozen doc changed');
}

if (failures.length > 0) {
  console.log(`FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL');
  process.exit(1);
}
console.log(`RESULT=PASS BASELINE=${baseline.slice(0, 12)} REPORT=${REPORT}`);
