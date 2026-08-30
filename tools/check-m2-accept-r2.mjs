#!/usr/bin/env node
// M2 独立验收评审（m2-accept-r2）机械验收器。
// 用法：node tools/check-m2-accept-r2.mjs --baseline <40hex>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) { console.log(`RESULT=FAIL REASON=missing-arg ${name}`); process.exit(1); }
  return args[i + 1];
}
const baseline = argOf('--baseline');
const REPORT = 'docs/milestones/m2/reviews/acceptance-r2.md';
const failures = [];
const ok = (name, cond, detail = '') => { if (!cond) failures.push(detail ? `${name}: ${detail}` : name); };
function git(...rest) { return execFileSync('git', rest, { encoding: 'utf8' }).trim(); }
function blobSha(rev, path) { return createHash('sha256').update(execFileSync('git', ['show', `${rev}:${path}`])).digest('hex'); }

const status = git('status', '--porcelain').split('\n').filter(Boolean);
ok('worktree-clean', status.every((l) => l === '?? PROMPT.md'), `status=[${status.join(' | ')}]`);
const count = git('rev-list', '--count', `${baseline}..HEAD`);
ok('commit-count', count === '1', `count=${count}`);
const author = git('log', '-1', '--format=%an <%ae>');
ok('commit-author', author === 'Remote Agent <agent@remote.kunora.ai>', `author=${author}`);
const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean);
ok('diff-whitelist', changed.length === 1 && changed[0] === REPORT, `changed=[${changed.join(', ')}]`);
let report = '';
try { report = readFileSync(REPORT, 'utf8').replace(/\r\n/g, '\n'); } catch (e) { ok('report-readable', false, String(e.message).slice(0, 80)); }
ok('report-size', Buffer.byteLength(report, 'utf8') >= 6000, `bytes=${Buffer.byteLength(report, 'utf8')}`);
for (const d of ['阶段目标达成', '交付物与计划符合度', '代码评审', '真实测试复跑', '总体结论']) {
  ok(`dim[${d}]`, report.includes(d), 'missing dimension');
}
for (let i = 1; i <= 18; i++) {
  const id = `T${String(i).padStart(2, '0')}`;
  ok(`task[${id}]`, report.includes(id), `missing ${id} coverage`);
}
for (let i = 1; i <= 9; i++) ok(`deliverable[D${i}]`, report.includes(`D${i}`), `missing D${i}`);
ok('overall-verdict', /总体结论[：:]\s*(通过独立验收|有条件通过|未通过独立验收)/.test(report), 'overall verdict line missing');
ok('per-dim-conclusions', (report.match(/(PASS|CONCERNS|FAIL)/g) || []).length >= 5);
for (const ev of ['cargo test', 'clippy', 'drift', 'validate_contracts', 'self-test', 'declared=66', 'executed=']) {
  ok(`evidence[${ev}]`, report.includes(ev), `missing re-run evidence: ${ev}`);
}
for (const t of ['CF-01', 'WRITER_GUARD_HELD', 'generation', 'N+1', 'READY', 'AC-03', 'VM-03', 'secret', 'token', 'cookie']) {
  ok(`m2-token[${t}]`, report.includes(t), `missing M2 token: ${t}`);
}
ok('ac01-07', ['AC-01','AC-02','AC-03','AC-04','AC-05','AC-06','AC-07'].every((a) => report.includes(a)));
// R2 专属：R1 F01-F07 处置核验
for (let i = 1; i <= 7; i++) {
  const id = `F${String(i).padStart(2, '0')}`;
  ok(`finding[${id}]`, report.includes(id), 'missing R1 finding disposition');
}
for (const ev of ['bin.js', 'LockFileEx', 'flock', 'graceful', 'BLOCKED-EXTERNAL', 'executed=', 'generation 1', 'READY']) {
  ok(`r2-evidence[${ev}]`, report.includes(ev), 'missing r2 fix evidence mention');
}
ok('vm01-06', ['VM-01','VM-02','VM-03','VM-04','VM-05','VM-06'].every((v) => report.includes(v)));
const frozen = ['docs/milestones/m2/six-elements.md', 'docs/milestones/m2/overall-plan.md', 'docs/milestones/m2/detailed-plan.md', 'docs/milestones/m1/six-elements.md', 'docs/milestones/m1/overall-plan.md', 'docs/milestones/m1/detailed-plan.md'];
for (const f of frozen) ok(`frozen[${f}]`, blobSha(baseline, f) === blobSha('HEAD', f), `${f} changed`);

if (failures.length > 0) {
  console.log(`FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL'); process.exit(1);
}
console.log(`RESULT=PASS BASELINE=${baseline.slice(0, 12)} REPORT=${REPORT}`);
