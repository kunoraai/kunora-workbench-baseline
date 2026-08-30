#!/usr/bin/env node
// M2 设计任务（m2-plan-r1）机械验收器 —— 冻结于 M2 六要素 v1.0 与 M1 交付基线。
// 用法：node tools/check-m2-plan.mjs --mode structural --baseline <40hex> --six <sha>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) { console.log(`RESULT=FAIL REASON=missing-arg ${name}`); process.exit(1); }
  return args[i + 1];
}
const mode = argOf('--mode');
const failures = [];
const ok = (name, cond, detail = '') => { if (!cond) failures.push(detail ? `${name}: ${detail}` : name); };
function git(...rest) { return execFileSync('git', rest, { encoding: 'utf8' }).trim(); }
function blobSha(rev, path) { return createHash('sha256').update(execFileSync('git', ['show', `${rev}:${path}`])).digest('hex'); }

if (mode === 'structural') {
  const baseline = argOf('--baseline');
  const six = argOf('--six');
  const status = git('status', '--porcelain').split('\n').filter(Boolean);
  ok('worktree-clean', status.every((l) => l === '?? PROMPT.md'), `status=[${status.join(' | ')}]`);
  const authors = git('log', `${baseline}..HEAD`, '--format=%an <%ae>').split('\n').filter(Boolean);
  ok('commits-exist', authors.length > 0);
  ok('commit-authors', authors.every((a) => a === 'Remote Agent <agent@remote.kunora.ai>'), authors.filter((a) => a !== 'Remote Agent <agent@remote.kunora.ai>').join(';'));
  const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean);
  const allowed = ['docs/milestones/m2/'];
  const bad = changed.filter((p) => !allowed.some((pre) => p.startsWith(pre)));
  ok('diff-whitelist', bad.length === 0, `out-of-scope=[${bad.join(', ')}]`);
  ok('frozen-six', blobSha(baseline, 'docs/milestones/m2/six-elements.md') === six && blobSha('HEAD', 'docs/milestones/m2/six-elements.md') === six);
  for (const f of ['docs/milestones/m1/six-elements.md', 'docs/milestones/m1/overall-plan.md', 'docs/milestones/m1/detailed-plan.md']) {
    ok(`frozen-m1[${f}]`, blobSha(baseline, f) === blobSha('HEAD', f));
  }
  const op = exists('docs/milestones/m2/overall-plan.md') ? readFileSync('docs/milestones/m2/overall-plan.md', 'utf8') : '';
  const dp = exists('docs/milestones/m2/detailed-plan.md') ? readFileSync('docs/milestones/m2/detailed-plan.md', 'utf8') : '';
  ok('overall-plan', op.length >= 6000, `overall-plan bytes=${op.length}`);
  ok('detailed-plan', dp.length >= 8000, `detailed-plan bytes=${dp.length}`);
  // 范围锚定：M2 关键词齐备
  for (const kw of ['state coordinator', 'supervisor', 'writer guard', 'flock', 'desired state', 'observed state', 'ready URL', 'cookie', 'probe', 'generation', 'crash recovery', 'ID-01', 'CF-01', 'ST-05', '真实 Harness']) {
    ok(`kw[${kw}]`, (op + dp).includes(kw), `missing keyword: ${kw}`);
  }
  // 边界纪律：不得把中央客户端/HTTP 代理纳入 M2 实现范围
  const out = ['register', 'heartbeat', 'lease', 'HTTP proxy', 'WebSocket'];
  for (const kw of out) {
    const hits = ((op + dp).match(new RegExp(kw, 'g')) || []).length;
    ok(`boundary[${kw}]`, hits <= 6, `keyword ${kw} appears ${hits} times (must stay within boundary discussion)`);
  }
  // T 任务编号与依赖 DAG 结构
  const tasks = [...dp.matchAll(/^### T(\d{2})/gm)].map((m) => Number(m[1]));
  ok('tasks-sequential', tasks.length >= 12 && tasks.every((t, i) => t === tasks[0] + i), `tasks=[${tasks.join(',')}]`);
  const deps = [...dp.matchAll(/依赖[:：]\s*(T\d{2}(?:[,，、 ]+T\d{2})*)/g)].map((m) => m[1]);
  ok('deps-present', deps.length >= 10, `dependency lines=${deps.length}`);
  // 出口映射：M2 出口门禁原文
  ok('exit-gate-verbatim', (op + dp).includes('dshd 能可靠管理并连接真实 Harness'), 'M2 exit gate must cite roadmap verbatim');
  // 完成矩阵与 AC 映射
  ok('ac-mapping', dp.includes('出口门禁') && dp.includes('验收标准'), 'exit mapping section required');
  // 参考链接合法（相对路径存在）
  const refs = [...(op + dp).matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1]).filter((r) => r.startsWith('..') || r.startsWith('./') || r.startsWith('docs'));
  for (const r of refs.slice(0, 30)) {
    const clean = r.split('#')[0];
    if (clean && !exists(clean)) ok(`ref[${clean}]`, false, 'missing referenced file');
  }
} else {
  console.log(`RESULT=FAIL REASON=unknown-mode ${mode}`); process.exit(1);
}
function exists(p) { try { readFileSync(p); return true; } catch { return false; } }

if (failures.length > 0) {
  console.log(`FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL'); process.exit(1);
}
console.log(`RESULT=PASS MODE=${mode} BASELINE=${baseline.slice(0, 12)}`);
