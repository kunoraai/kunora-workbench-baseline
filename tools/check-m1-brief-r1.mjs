#!/usr/bin/env node
// M1 里程碑交付简报（m1-brief-r1）机械验收器。
// 用法：node tools/check-m1-brief-r1.mjs --baseline <40hex>
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
const REPORT = 'docs/milestones/m1/briefing/m1-briefing.html';
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
let html = '';
try { html = readFileSync(REPORT, 'utf8'); } catch (e) { ok('report-readable', false, String(e.message).slice(0, 80)); }
ok('html-size', Buffer.byteLength(html, 'utf8') >= 8000, `bytes=${Buffer.byteLength(html, 'utf8')}`);
ok('html-doctype', /^\s*<!DOCTYPE html>/i.test(html), 'missing <!DOCTYPE html>');
ok('html-closed', /<\/html>\s*$/i.test(html.trimEnd()), 'missing closing </html>');
ok('html-charset', /charset=["']?utf-8/i.test(html), 'missing utf-8 charset');
ok('html-selfcontained', !/<(img|script|link)[^>]+(src|href)=["']https?:/i.test(html), 'external assets forbidden');
for (const s of ['目标达成', '交付物', '验收', '代码评审', '真实测试', '遗留事项']) {
  ok(`section[${s}]`, html.includes(s), 'missing section');
}
for (const c of ['ab47138', 'f0ea823', 'faeab2f', 'c1c25ee']) {
  ok(`commit[${c}]`, html.includes(c), 'missing commit reference');
}
for (const t of ['BLOCKED-EXTERNAL', 'PENDING', 'declared=66', 'executed=0', 'route_probe=13/13', '未通过独立验收', '通过独立验收']) {
  ok(`token[${t}]`, html.includes(t), 'missing required token');
}
const frozen = ['docs/milestones/m1/six-elements.md', 'docs/milestones/m1/overall-plan.md', 'docs/milestones/m1/detailed-plan.md'];
for (const f of frozen) ok(`frozen[${f}]`, blobSha(baseline, f) === blobSha('HEAD', f));

if (failures.length > 0) {
  console.log(`FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL'); process.exit(1);
}
console.log(`RESULT=PASS BASELINE=${baseline.slice(0, 12)} REPORT=${REPORT}`);
