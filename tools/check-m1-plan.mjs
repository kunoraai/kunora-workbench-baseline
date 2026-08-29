#!/usr/bin/env node
// M1 总体方案与详细计划设计任务的机械验收器（冻结于基线提交）。
// 用法：node tools/check-m1-plan.mjs --baseline <40-hex> --six-elements-sha256 <sha256>
// 判定：全部检查通过输出 RESULT=PASS 且退出码 0；任一失败输出 RESULT=FAIL 与失败清单且退出码 1。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const sixSha = argOf('--six-elements-sha256');

const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
};

function git(...rest) {
  return execFileSync('git', rest, { encoding: 'utf8' }).trim();
}
function blobSha(rev, path) {
  const buf = execFileSync('git', ['show', `${rev}:${path}`]);
  return createHash('sha256').update(buf).digest('hex');
}
function readNorm(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

const DELIVERABLES = ['docs/milestones/m1/overall-plan.md', 'docs/milestones/m1/detailed-plan.md'];
const SIX_ELEMENTS = 'docs/milestones/m1/six-elements.md';

// 1. 恰好一次提交
const count = git('rev-list', '--count', `${baseline}..HEAD`);
ok('commit-count', count === '1', `rev-list --count ${baseline}..HEAD = ${count}, expected 1`);

// 2. 变更白名单精确等于两份交付物
const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean).sort();
const expected = [...DELIVERABLES].sort();
ok(
  'diff-whitelist',
  changed.length === expected.length && changed.every((v, i) => v === expected[i]),
  `changed=[${changed.join(', ')}], expected=[${expected.join(', ')}]`,
);

// 3. 提交身份
const author = git('log', '-1', '--format=%an <%ae>');
ok('commit-author', author === 'Remote Agent <agent@remote.kunora.ai>', `author=${author}`);

// 4. 工作区干净（仅允许未跟踪控制文件 PROMPT.md）
const status = git('status', '--porcelain').split('\n').filter(Boolean);
const dirty = status.filter((l) => l !== '?? PROMPT.md');
ok('worktree-clean', dirty.length === 0, `dirty=[${dirty.join(' | ')}]`);

// 5. 冻结六要素不可变（按 git blob 字节校验，规避检出换行差异）
let sixActual = '';
try {
  sixActual = blobSha(baseline, SIX_ELEMENTS);
  const sixHead = blobSha('HEAD', SIX_ELEMENTS);
  ok('six-elements-frozen', sixActual === sixSha && sixHead === sixSha, `baseline=${sixActual.slice(0, 12)} head=${sixHead.slice(0, 12)} expected=${sixSha.slice(0, 12)}`);
} catch (e) {
  ok('six-elements-frozen', false, `git show failed: ${String(e.message).slice(0, 80)}`);
}

// 6. 交付物结构与内容检查（CRLF 归一后判定）
let overall = '';
let detailed = '';
try {
  overall = readNorm(DELIVERABLES[0]);
  detailed = readNorm(DELIVERABLES[1]);
} catch (e) {
  ok('deliverables-readable', false, String(e.message).slice(0, 80));
}

const overallRequired = [
  '修订记录',
  '最终目标',
  'Cargo',
  'OpenAPI',
  'CI',
  'Docker',
  'fake Harness',
  'reference stub',
  'runner',
  '能力覆盖',
  '风险',
  '六要素',
];
for (const token of overallRequired) {
  ok(`overall-contains[${token}]`, overall.includes(token), overall.length === 0 ? 'file missing/empty' : undefined);
}
ok('overall-size', Buffer.byteLength(overall, 'utf8') >= 5000, `overall-plan.md bytes=${Buffer.byteLength(overall, 'utf8')}`);

const detailedRequired = [
  '修订记录',
  '任务',
  '依赖',
  '验收',
  '六要素',
  '出口门禁',
  'M1',
];
for (const token of detailedRequired) {
  ok(`detailed-contains[${token}]`, detailed.includes(token), detailed.length === 0 ? 'file missing/empty' : undefined);
}
ok('detailed-size', Buffer.byteLength(detailed, 'utf8') >= 5000, `detailed-plan.md bytes=${Buffer.byteLength(detailed, 'utf8')}`);

// 7. 两份文档都必须引用冻结六要素文档作为范围权威
const refsSix = overall.includes('six-elements.md') && detailed.includes('six-elements.md');
ok('reference-six-elements', refsSix);

if (failures.length > 0) {
  console.log('RESULT=PASS_COUNT=0 FAILURES=' + failures.length);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL');
  process.exit(1);
}
console.log(`RESULT=PASS BASELINE=${baseline.slice(0, 12)} SIX_ELEMENTS_SHA256=${sixSha.slice(0, 16)}… CHECKS=24`);
