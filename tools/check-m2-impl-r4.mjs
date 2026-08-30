#!/usr/bin/env node
// M2 实现任务（m2-impl-r4）机械验收器 —— 依 M2 详细计划（frozen）构建。
// 模式：
//   structural    git/白名单/冻结摘要/M2 计划关键交付物存在性
//   cargo-check   cargo check --workspace --all-targets --locked
//   clippy        cargo clippy --workspace --all-targets --locked -- -D warnings（M1 教训：必须含）
//   cargo-test    cargo test --workspace --locked
//   drift-real    contract-gen --check + 损毁负向门（M1 真负向门沿用）
//   selftests-real 四资产 version/self-test + M1 负向门 + M2 fixture 自检
//   m2-evidence    M2 真实现证据：CF-01/ST-05/真实 Harness/runner 计数/secret 扫描
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) { console.log(`RESULT=FAIL REASON=missing-arg ${name}`); process.exit(1); }
  return args[i + 1];
}
const mode = argOf('--mode');
function cargoBin() {
  const probe = (cmd) => { const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }); return r.status === 0 ? cmd : null; };
  return probe('cargo') || probe(join(homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo'));
}
function runCargo(cargoArgs, timeoutMs) {
  const bin = cargoBin();
  if (!bin) return { code: -1, out: 'cargo not resolvable' };
  const r = spawnSync(bin, cargoArgs, {
    encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PATH: `${process.env.PATH || ''}${process.platform === 'win32' ? ';' : ':'}${join(homedir(), '.cargo', 'bin')}`, CARGO_TERM_COLOR: 'never' },
  });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}`.slice(-4000) };
}
function git(...rest) { return execFileSync('git', rest, { encoding: 'utf8' }).trim(); }
function blobSha(rev, path) { return createHash('sha256').update(execFileSync('git', ['show', `${rev}:${path}`])).digest('hex'); }
function trackedFilesUnder(prefix) { return git('ls-files', prefix).split('\n').filter(Boolean); }
function readIf(p) { return existsSync(p) ? readFileSync(p, 'utf8') : ''; }
const failures = [];
const ok = (name, cond, detail = '') => { if (!cond) failures.push(detail ? `${name}: ${detail}` : name); };

if (mode === 'structural') {
  const baseline = argOf('--baseline');
  const six = argOf('--six');
  const plan = argOf('--plan');
  const dplan = argOf('--dplan');
  const status = git('status', '--porcelain').split('\n').filter(Boolean);
  ok('worktree-clean', status.every((l) => l === '?? PROMPT.md'), `status=[${status.join(' | ')}]`);
  const authors = git('log', `${baseline}..HEAD`, '--format=%an <%ae>').split('\n').filter(Boolean);
  ok('commits-exist', authors.length > 0);
  ok('commit-authors', authors.every((a) => a === 'Remote Agent <agent@remote.kunora.ai>'), authors.filter((a) => a !== 'Remote Agent <agent@remote.kunora.ai>').join(';'));
  const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean);
  const allowedFiles = new Set(['Cargo.toml','Cargo.lock','rust-toolchain.toml','.gitignore','.gitattributes','rustfmt.toml','.rustfmt.toml','clippy.toml','Dockerfile','.dockerignore','deny.toml']);
  const allowedPrefixes = ['crates/','tools/','tests/','.github/','docker/','scripts/','docs/milestones/m2/'];
  const forbiddenExact = new Set(['tools/check-m1-plan.mjs','tools/check-m1-impl-r1.mjs','tools/check-m1-impl-r2.mjs','tools/check-m1-impl-r3.mjs','tools/check-m1-impl-r4.mjs','tools/check-m1-accept-r1.mjs','tools/check-m1-accept-r2.mjs','tools/check-m1-accept-r3.mjs','tools/check-m1-brief-r1.mjs','tools/check-m2-plan.mjs','tools/check-m2-impl-r4.mjs']);
  const bad = changed.filter((p) => forbiddenExact.has(p) || !(allowedFiles.has(p) || allowedPrefixes.some((pre) => p.startsWith(pre))));
  ok('diff-whitelist', bad.length === 0, `out-of-scope=[${bad.join(', ')}]`);
  // 冻结摘要：M1 全部冻结文档 + M2 三文档
  const frozen = { 'docs/milestones/m1/six-elements.md': null, 'docs/milestones/m1/overall-plan.md': null, 'docs/milestones/m1/detailed-plan.md': null, 'docs/milestones/m2/six-elements.md': six, 'docs/milestones/m2/overall-plan.md': plan, 'docs/milestones/m2/detailed-plan.md': dplan };
  for (const [p, exp] of Object.entries(frozen)) {
    if (exp) ok(`frozen[${p}]`, blobSha(baseline, p) === exp && blobSha('HEAD', p) === exp);
    else ok(`frozen[${p}]`, blobSha(baseline, p) === blobSha('HEAD', p));
  }
  // M1 交付物不可回退：drift/生成物/工具入口
  const gen = trackedFilesUnder('crates/dshd-contract/src/generated/').filter((f) => f.endsWith('.rs'));
  ok('generated-types', gen.length >= 3);
  const manifest = trackedFilesUnder('tools/conformance-runner/').filter((f) => f.endsWith('.csv'));
  ok('manifest-still-66', manifest.length >= 1 && readIf(manifest[manifest.length - 1]).match(/\b(ID|CF|ST|PX|SR|CT|PV)-\d{2}\b/g)?.length === 66);
  // M2 领域模块真实化（core 纯领域 / adapter OS）
  const coreFiles = trackedFilesUnder('crates/dshd-core/src/').join('\n');
  for (const m of ['config', 'identity', 'state']) ok(`core[${m}]`, new RegExp(`${m}(_mod)?\\.rs|mod ${m}`, 'i').test(coreFiles), `dshd-core missing ${m}`);
  const coreSrc = trackedFilesUnder('crates/dshd-core/src/').map((f) => readIf(f)).join('\n');
  for (const t of ['Snapshot', 'Event', 'Effect', 'Generation']) ok(`core-type[${t}]`, coreSrc.includes(t), `dshd-core missing ${t}`);
  const adpFiles = trackedFilesUnder('crates/dshd-adapters/src/');
  const adpSrc = adpFiles.map((f) => readIf(f)).join('\n');
  ok('adapter-atomic-store', /IdentityStore|DesiredStore|atomic|rename|fsync/i.test(adpSrc), 'atomic identity/desired adapter missing');
  ok('adapter-writer-guard', /flock|writer.?guard|WRITER_GUARD_HELD/i.test(adpSrc), 'writer guard adapter missing');
  ok('guard-real-os-lock', /flock|LockFileEx|LockFile|lock\(\)/.test(adpSrc), 'writer guard must use real OS kernel lock, not sentinel file (F03)');
  ok('atomic-replace-no-delete-window', !/path\.exists\(\)[^\n]*remove_file|remove_file\(path\)[^\n]*rename/.test(adpSrc), 'desired/identity write must not delete-then-rename (F02)');
  ok('graceful-stop-escalation', /terminate|grace|stop_timeout|SIGTERM/.test(adpSrc), 'supervisor must implement bounded graceful stop escalation (F05)');
  ok('adapter-supervisor', /spawn|process|backoff/i.test(adpSrc), 'supervisor/backoff adapter missing');
  ok('adapter-ready-auth', /ready.?url|authority|cookie|probe/i.test(adpSrc), 'ready/auth bootstrap adapter missing');
  // M2 装配：main 顺序 + 无第二套 DTO
  const mainSrc = trackedFilesUnder('crates/dshd/src/').map((f) => readIf(f)).join('\n');
  ok('main-assemble', /config|identity|desired|guard|coordinator|supervisor/i.test(mainSrc), 'dshd main must assemble config→identity→desired→guard→coordinator→supervisor');
  const coreTests = trackedFilesUnder('crates/dshd-core/tests/').concat(trackedFilesUnder('crates/dshd-core/src/')).map((f) => readIf(f)).join('\n');
  ok('reducer-priority-late-fence', /priorit|late|fence/.test(coreTests), 'reducer priority/late-fence coverage required (F06)');
  ok('snapshot-subscribe', /subscribe|broadcast|watch/.test(coreTests), 'snapshot subscription interface required (F06)');
  // runner M2 driver
  const runnerSrc = trackedFilesUnder('tools/conformance-runner/src/').map((f) => readIf(f)).join('\n');
  ok('runner-driver', /driver|executed|DECLARED/i.test(runnerSrc), 'runner must gain M2 driver semantics');
  // capability evidence 扩展
  const capSrc = trackedFilesUnder('tools/capability-report/src/').map((f) => readIf(f)).join('\n');
  ok('cap-evidence', /evidence|artifact|digest/i.test(capSrc), 'capability-report must register evidence bits');
  // M2 报告与出口记录
  const reports = trackedFilesUnder('docs/milestones/m2/reports/');
  ok('m2-reports', reports.length >= 4, `reports=${reports.length} (expect >=4)`);
  const exitRec = readIf('docs/milestones/m2/exit-record.md');
  ok('exit-record', exitRec.includes('AC-01') && exitRec.includes('AC-07') && exitRec.includes('declared=66'), 'm2 exit-record skeleton required (AC-01..07, declared=66)');
  // CI 分层 job + --locked
  const wfAll = trackedFilesUnder('.github/workflows/').map((f) => readIf(f)).join('\n');
  for (const j of ['format', 'lint', 'check', 'unit', 'contract', 'real-harness', 'runner', 'secret']) ok(`ci-job[${j}]`, wfAll.includes(j), `CI missing ${j} job/step`);
  ok('ci-locked', wfAll.includes('--locked'));
  // 真实 Harness 集成测试引用固定启动方式
  const testSrc = trackedFilesUnder('crates/').concat(trackedFilesUnder('tests/')).map((f) => readIf(f)).join('\n');
  ok('real-harness-cmd', /dsh web --no-open --port 0/.test(testSrc), 'integration must use fixed dsh web --no-open --port 0');
  const runScript = readIf('scripts/run-m2-real-harness.mjs');
  ok('run-script-reproducible-build', /build|ensure|bin\.js|entry/i.test(runScript), 'run script must include reproducible build/entry-existence step (F01)');
  ok('frozen-snapshot-ro', /dsh\//.test(readIf('docs/dsh/harness-version-baseline.md')));
} else if (mode === 'cargo-check') {
  const r = runCargo(['check', '--workspace', '--all-targets', '--locked'], 1500 * 1000);
  ok('cargo-check', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
} else if (mode === 'clippy') {
  const r = runCargo(['clippy', '--workspace', '--all-targets', '--locked', '--', '-D', 'warnings'], 1800 * 1000);
  ok('clippy', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
} else if (mode === 'cargo-test') {
  const r = runCargo(['test', '--workspace', '--locked'], 2400 * 1000);
  ok('cargo-test', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
} else if (mode === 'drift-real') {
  const clean = runCargo(['run', '--locked', '-p', 'contract-gen', '--', '--check'], 1200 * 1000);
  ok('drift-clean-zero', clean.code === 0 && /RESULT=PASS|ZERO_DRIFT|no drift/i.test(clean.out), `exit=${clean.code} tail=${clean.out.slice(-300)}`);
  const genFiles = trackedFilesUnder('crates/dshd-contract/src/generated/').filter((f) => f.endsWith('.rs'));
  ok('gen-files-exist', genFiles.length >= 1);
  if (genFiles.length >= 1) {
    const victim = genFiles[genFiles.length - 1];
    const backup = `${victim}.m2r1bak`;
    copyFileSync(victim, backup);
    try {
      writeFileSync(victim, readFileSync(victim, 'utf8') + '\n// m2r1 drift probe\n', 'utf8');
      const dirty = runCargo(['run', '--locked', '-p', 'contract-gen', '--', '--check'], 1200 * 1000);
      ok('drift-negative-fails', dirty.code !== 0, `corrupted generated file NOT detected (exit=${dirty.code})`);
    } finally { copyFileSync(backup, victim); unlinkSync(backup); }
    const recheck = runCargo(['run', '--locked', '-p', 'contract-gen', '--', '--check'], 1200 * 1000);
    ok('drift-restore-clean', recheck.code === 0);
  }
} else if (mode === 'selftests-real') {
  for (const pkg of ['conformance-runner', 'fake-harness', 'reference-stub', 'capability-report']) {
    const v = runCargo(['run', '--locked', '-p', pkg, '--', '--version'], 900 * 1000);
    ok(`${pkg}-version`, v.code === 0 && /[0-9]+\.[0-9]+\.[0-9]+/.test(v.out), `exit=${v.code}`);
    const s = runCargo(['run', '--locked', '-p', pkg, '--', '--self-test'], 900 * 1000);
    ok(`${pkg}-selftest`, s.code === 0, `exit=${s.code} tail=${s.out.slice(-200)}`);
    if (pkg === 'conformance-runner') ok('runner-66', s.out.includes('declared=66') && s.out.includes('executed='));
  }
  // M1 负向门沿用：manifest 损毁必失败
  const manifest = trackedFilesUnder('tools/conformance-runner/').filter((f) => f.endsWith('.csv')).pop();
  if (manifest) {
    const tmp = join('.', '.m2r1-manifest-corrupt.tmp');
    writeFileSync(tmp, readIf(manifest).replace(/ID-01/, 'ID-XX'), 'utf8');
    const bad = runCargo(['run', '--locked', '-p', 'conformance-runner', '--', '--self-test', '--manifest', tmp], 900 * 1000);
    ok('runner-manifest-enforced', bad.code !== 0, 'corrupted manifest NOT detected');
    try { unlinkSync(tmp); } catch {}
  }
  // M2：fake Harness fixture 自检（ready/cookie/probe/crash/挂起场景）
  const fh = runCargo(['run', '--locked', '-p', 'fake-harness', '--', '--self-test'], 900 * 1000);
  ok('fake-m2-fixtures', /ready|crash|hang|probe|cookie|token/i.test(fh.out), 'fake-harness self-test must cover M2 fixtures');
  // M2：reference stub 本地输入 driver 自检
  const rs = runCargo(['run', '--locked', '-p', 'reference-stub', '--', '--self-test'], 900 * 1000);
  ok('stub-m2-driver', /driver|scenario|STALE|FENCED|unreachable/i.test(rs.out), 'reference-stub self-test must exercise local input driver');
} else if (mode === 'm2-evidence') {
  // CF-01 双进程证据
  const cf = readIf('docs/milestones/m2/reports/t04-writer-guard.md') + readIf('docs/milestones/m2/reports/t17-hardening.md');
  ok('cf01-evidence', /WRITER_GUARD_HELD/.test(cf) && /PID|pid|进程|双进程/.test(cf), 'CF-01 double-process evidence required in t04/t17 reports');
  // ST-05 crash recovery + N+1
  const st5 = readIf('docs/milestones/m2/reports/t08-reconcile.md') + readIf('docs/milestones/m2/reports/t14-real-harness.md');
  ok('st05-evidence', /generation|N\+1|退避|backoff|READY/.test(st5), 'ST-05 recovery/N+1 evidence required');
  // 真实 Harness 证据
  const t14 = readIf('docs/milestones/m2/reports/t14-real-harness.md');
  ok('real-harness-evidence', /READY|dsh web --no-open --port 0|generation/.test(t14), 't14 must record real Harness startup→READY chain');
  // runner executed 计数诚实（>0 且 <66，66 declared）
  const t15 = readIf('docs/milestones/m2/reports/t15-runner.md');
  ok('runner-executed-honest', /declared=66/.test(t15) && /executed=[1-9]\d*/.test(t15), 't15 must show declared=66 with 0<executed<66');
  const execN = Number((t15.match(/executed=(\d+)/) || [])[1]);
  ok('runner-executed-range', execN > 0 && execN < 66, `executed=${execN} must be in (0,66)`);
  // AC-01..07 出口口径（诚实 PENDING/BLOCKED 允许，不得把未执行写成 PASS）
  const exitRec = readIf('docs/milestones/m2/exit-record.md');
  ok('exit-ac01-07', ['AC-01','AC-02','AC-03','AC-04','AC-05','AC-06','AC-07'].every((a) => exitRec.includes(a)));
  ok('ac03-product-path', /AC-03[^\n]*PASS/.test(exitRec), 'AC-03 must be PASS: product-path (dshd-assembled) real N+1 transcript required');
  ok('ac01-honest', /AC-01[^\n]*(BLOCKED|PENDING)/.test(exitRec), 'AC-01 must be BLOCKED-EXTERNAL or PENDING while CI blocked (F04)');
  ok('vm01-honest', /VM-01[^\n]*(BLOCKED|PENDING)/.test(exitRec), 'VM-01 must be BLOCKED-EXTERNAL or PENDING while CI blocked (F04)');
  ok('exit-vm', ['VM-01','VM-02','VM-03','VM-04','VM-05','VM-06'].every((v) => exitRec.includes(v)));
  // secret 扫描：提交文件内不得出现真实形态的 launch token/cookie（报告/日志/JSON/JUnit）
  const gr = spawnSync('git', ['grep', '-I', '-l', '-e', '?token=[A-Za-z0-9_-]\{16,\}', '-e', 'launch[-_]token[=:][A-Za-z0-9_-]\{16,\}', '--', ':!tools/fake-harness', ':!crates/dshd-contract/tests', ':!crates/dshd-adapters/tests'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const hits = gr.status === 0 ? (gr.stdout || '').trim() : '';
  const grepErr = gr.status !== 0 && gr.status !== 1 ? `git grep error status=${gr.status} ${(gr.stderr || '').slice(0, 120)}` : '';
  ok('secret-scan', hits === '' && grepErr === '', `plaintext secret pattern found in: ${hits} ${grepErr}`);
} else {
  console.log(`RESULT=FAIL REASON=unknown-mode ${mode}`); process.exit(1);
}

if (failures.length > 0) {
  console.log(`MODE=${mode} FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL'); process.exit(1);
}
console.log(`RESULT=PASS MODE=${mode}`);
