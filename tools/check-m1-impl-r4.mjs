#!/usr/bin/env node
// M1 实现迭代 2（m1-impl-r4）机械验收器 —— 针对独立验收 R1 发现 F01-F12 的强化门禁。
// 用法：
//   node tools/check-m1-impl-r4.mjs --mode structural --baseline <40hex> --six <sha> --plan <sha> --dplan <sha>
//   node tools/check-m1-impl-r4.mjs --mode cargo-check
//   node tools/check-m1-impl-r4.mjs --mode cargo-test
//   node tools/check-m1-impl-r4.mjs --mode drift-real
//   node tools/check-m1-impl-r4.mjs --mode selftests-real
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
const failures = [];
const ok = (name, cond, detail = '') => { if (!cond) failures.push(detail ? `${name}: ${detail}` : name); };

if (mode === 'structural') {
  const baseline = argOf('--baseline');
  const expected = {
    'docs/milestones/m1/six-elements.md': argOf('--six'),
    'docs/milestones/m1/overall-plan.md': argOf('--plan'),
    'docs/milestones/m1/detailed-plan.md': argOf('--dplan'),
  };
  const status = git('status', '--porcelain').split('\n').filter(Boolean);
  ok('worktree-clean', status.every((l) => l === '?? PROMPT.md'), `status=[${status.join(' | ')}]`);
  const authors = git('log', `${baseline}..HEAD`, '--format=%an <%ae>').split('\n').filter(Boolean);
  ok('commits-exist', authors.length > 0);
  ok('commit-authors', authors.every((a) => a === 'Remote Agent <agent@remote.kunora.ai>'), authors.filter((a) => a !== 'Remote Agent <agent@remote.kunora.ai>').join(';'));
  const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean);
  const allowedFiles = new Set(['Cargo.toml','Cargo.lock','rust-toolchain.toml','.gitignore','.gitattributes','rustfmt.toml','.rustfmt.toml','clippy.toml','Dockerfile','.dockerignore','deny.toml']);
  const allowedPrefixes = ['crates/','tools/','tests/','.github/','docker/','scripts/','docs/milestones/m1/'];
  const forbiddenExact = new Set(['tools/check-m1-plan.mjs','tools/check-m1-impl-r1.mjs','tools/check-m1-impl-r4.mjs','tools/check-m1-accept-r1.mjs','docs/milestones/m1/reviews/acceptance-r1.md']);
  const bad = changed.filter((p) => forbiddenExact.has(p) || !(allowedFiles.has(p) || allowedPrefixes.some((pre) => p.startsWith(pre))));
  ok('diff-whitelist', bad.length === 0, `out-of-scope=[${bad.join(', ')}]`);
  for (const [path, exp] of Object.entries(expected)) {
    ok(`frozen[${path}]`, blobSha(baseline, path) === exp && blobSha('HEAD', path) === exp);
  }
  // F02: 真实校验栈依赖闭包
  const lock = existsSync('Cargo.lock') ? readFileSync('Cargo.lock', 'utf8') : '';
  ok('cargo-lock-exists', lock.length > 0);
  ok('lock-has-jsonschema', /name = "jsonschema"/.test(lock), 'Cargo.lock must contain jsonschema crate');
  const jcsOk = /(name = "jcs"|name = "rfc8785"|name = "canonical-json")/.test(lock);
  ok('lock-has-jcs', jcsOk, 'Cargo.lock must contain a JCS/RFC 8785 implementation crate (jcs/rfc8785/canonical-json)');
  // F01: 生成物目录
  const gen = trackedFilesUnder('crates/dshd-contract/src/generated/').filter((f) => f.endsWith('.rs'));
  ok('generated-types', gen.length >= 3, `generated .rs files=${gen.length}, expected >=3`);
  // F04: manifest 精确枚举 66 项
  const manifestCandidates = trackedFilesUnder('tools/conformance-runner/').filter((f) => f.endsWith('.csv') || f.endsWith('.json'));
  let manifestPath = '';
  let idCount = 0;
  for (const m of manifestCandidates) {
    const c = (readFileSync(m, 'utf8').match(/\b(ID|CF|ST|PX|SR|CT|PV)-\d{2}\b/g) || []).length;
    if (c > idCount) { idCount = c; manifestPath = m; }
  }
  ok('manifest-66', idCount === 66, `best candidate ${manifestPath} has ${idCount} vector IDs, expected 66`);
  // F09/F11: CI 结构与 target 锁定
  const wfFiles = trackedFilesUnder('.github/workflows/').filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  const wfAll = wfFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  ok('ci-contract-generate', /contract-generate|contract_generate/.test(wfAll), 'workflow must contain contract-generate job');
  ok('ci-job-fmt', /^\s+fmt:/m.test(wfAll) || /job.*fmt/.test(wfAll), 'separate fmt job missing');
  ok('ci-job-clippy', /^\s*clippy:/m.test(wfAll) || /job.*clippy/.test(wfAll), 'separate clippy job missing');
  ok('ci-asset-version', wfAll.includes('--version'), 'workflow must run assets --version');
  ok('ci-locked', wfAll.includes('--locked'));
  const tc = existsSync('rust-toolchain.toml') ? readFileSync('rust-toolchain.toml', 'utf8') : '';
  ok('toolchain-targets', /targets\s*=\s*\[/.test(tc), 'rust-toolchain.toml must pin targets');
  // F10: Dockerfile closure 复制口径（不得整树复制 harness 源码目录）
  const dk = existsSync('Dockerfile') ? readFileSync('Dockerfile', 'utf8') : '';
  ok('dockerfile-closure', /closure/i.test(dk), 'Dockerfile must reference a verified runtime closure');
  ok('dockerfile-no-src-copy', !/COPY --from=harness-builder\s+\/harness\s+\/opt\/dsh/.test(dk), 'must not copy entire /harness tree');
  // F12: 出口记录不得过度签核 AC-02（在真实生成证据就位前必须为 PENDING/FAIL 或引用 gate 检查工件）
  const exitRec = existsSync('docs/milestones/m1/exit-record.md') ? readFileSync('docs/milestones/m1/exit-record.md', 'utf8') : '';
  ok('exit-record-ac02-honest', /AC-02[^\n]*(PENDING|FAIL|contract-gen --check)/.test(exitRec), 'AC-02 must be PENDING/FAIL or cite contract-gen --check evidence');
  // 迭代报告
  const r2report = trackedFilesUnder('docs/milestones/m1/reports/').filter((f) => /r2|iteration|fix/i.test(f));
  ok('r2-fix-report', r2report.length >= 1, 'iteration fix report missing under docs/milestones/m1/reports/');
} else if (mode === 'cargo-check') {
  const r = runCargo(['check', '--workspace', '--all-targets', '--locked'], 1500 * 1000);
  ok('cargo-check', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
} else if (mode === 'cargo-test') {
  const r = runCargo(['test', '--workspace', '--locked'], 2100 * 1000);
  ok('cargo-test', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
} else if (mode === 'drift-real') {
  // F03/F06: 真实生成 drift 正负门
  const clean = runCargo(['run', '--locked', '-p', 'contract-gen', '--', '--check'], 1200 * 1000);
  ok('drift-clean-zero', clean.code === 0 && /RESULT=PASS|ZERO_DRIFT|no drift/i.test(clean.out), `exit=${clean.code} tail=${clean.out.slice(-300)}`);
  const genFiles = trackedFilesUnder('crates/dshd-contract/src/generated/').filter((f) => f.endsWith('.rs'));
  ok('gen-files-exist', genFiles.length >= 1, 'no generated files to corrupt');
  if (genFiles.length >= 1) {
    const victim = genFiles[genFiles.length - 1];
    const backup = `${victim}.m1r2bak`;
    copyFileSync(victim, backup);
    try {
      writeFileSync(victim, readFileSync(victim, 'utf8') + '\n// m1r2 drift probe\n', 'utf8');
      const dirty = runCargo(['run', '--locked', '-p', 'contract-gen', '--', '--check'], 1200 * 1000);
      ok('drift-negative-fails', dirty.code !== 0, `corrupted generated file was NOT detected (exit=${dirty.code})`);
    } finally {
      copyFileSync(backup, victim);
      unlinkSync(backup);
    }
    const recheck = runCargo(['run', '--locked', '-p', 'contract-gen', '--', '--check'], 1200 * 1000);
    ok('drift-restore-clean', recheck.code === 0, `restore failed exit=${recheck.code}`);
  }
} else if (mode === 'selftests-real') {
  // 四资产 version + self-test
  for (const pkg of ['conformance-runner', 'fake-harness', 'reference-stub', 'capability-report']) {
    const v = runCargo(['run', '--locked', '-p', pkg, '--', '--version'], 900 * 1000);
    ok(`${pkg}-version`, v.code === 0 && /[0-9]+\.[0-9]+\.[0-9]+/.test(v.out), `exit=${v.code} out=${v.out.slice(0, 100)}`);
    const s = runCargo(['run', '--locked', '-p', pkg, '--', '--self-test'], 900 * 1000);
    ok(`${pkg}-selftest`, s.code === 0, `exit=${s.code} tail=${s.out.slice(-200)}`);
    if (pkg === 'conformance-runner') {
      ok('runner-66', s.out.includes('declared=66') && s.out.includes('executed=0'));
    }
  }
  // F05: runner 必须真实读取 manifest（损毁副本必须导致 self-test 失败）
  const manifestCandidates = trackedFilesUnder('tools/conformance-runner/').filter((f) => f.endsWith('.csv') || f.endsWith('.json'));
  let manifestPath = '';
  let idCount = 0;
  for (const m of manifestCandidates) {
    const c = (readFileSync(m, 'utf8').match(/\b(ID|CF|ST|PX|SR|CT|PV)-\d{2}\b/g) || []).length;
    if (c > idCount) { idCount = c; manifestPath = m; }
  }
  ok('manifest-found', manifestPath.length > 0 && idCount === 66, `manifest=${manifestPath} ids=${idCount}`);
  if (manifestPath) {
    const tmp = join('.', '.m1r2-manifest-corrupt.tmp');
    writeFileSync(tmp, readFileSync(manifestPath, 'utf8').replace(/ID-01/, 'ID-XX'), 'utf8');
    const bad = runCargo(['run', '--locked', '-p', 'conformance-runner', '--', '--self-test', '--manifest', tmp], 900 * 1000);
    ok('runner-manifest-enforced', bad.code !== 0, 'corrupted manifest was NOT detected by self-test');
    try { unlinkSync(tmp); } catch {}
  }
  // F08: capability-report 必须真实读取 inventory（损毁副本必须失败）
  const invCandidates = trackedFilesUnder('tools/capability-report/').filter((f) => f.endsWith('.csv') || f.endsWith('.json'));
  let invPath = '';
  let invIds = 0;
  for (const m of invCandidates) {
    const c = (readFileSync(m, 'utf8').match(/\b(WUI|DSHD|OUT)-[A-Z0-9-]+\b/g) || []).length;
    if (c > invIds) { invIds = c; invPath = m; }
  }
  ok('inventory-found', invPath.length > 0 && invIds >= 30, `inventory=${invPath} ids=${invIds} (expect WUI/DSHD/OUT 全量)`);
  if (invPath) {
    const tmp = join('.', '.m1r2-inventory-corrupt.tmp');
    const txt = readFileSync(invPath, 'utf8');
    writeFileSync(tmp, txt.replace(/\bWUI-001\b/, 'WUI-999'), 'utf8');
    const bad = runCargo(['run', '--locked', '-p', 'capability-report', '--', '--self-test', '--inventory', tmp], 900 * 1000);
    ok('capreport-inventory-enforced', bad.code !== 0, 'same-count unknown ID (WUI-001->WUI-999) was NOT detected');
    try { unlinkSync(tmp); } catch {}
  }
  // F06/F07: fake/stub 自检必须包含真实网络启动证据
  const fh2 = runCargo(['run', '--locked', '-p', 'fake-harness', '--', '--self-test'], 900 * 1000);
  ok('fake-harness-loopback', /127\.0\.0\.1:\d+/.test(fh2.out) && /ready/i.test(fh2.out) && /probe/i.test(fh2.out), 'self-test must bind loopback, emit ready URL, and probe');
  // R4: stub 自检必须连续 3 次通过（Windows 阻塞 socket 稳定性负向门）
  for (let attempt = 1; attempt <= 3; attempt++) {
    const rs = runCargo(['run', '--locked', '-p', 'reference-stub', '--', '--self-test'], 900 * 1000);
    ok(`reference-stub-started[${attempt}]`, rs.code === 0 && /127\.0\.0\.1:\d+/.test(rs.out) && /(registry|client)/i.test(rs.out), `run ${attempt} exit=${rs.code} tail=${rs.out.slice(-160)}`);
    ok(`stub-route-probe-13[${attempt}]`, /route_probe=13\/13/i.test(rs.out), `run ${attempt} missing route_probe=13/13`);
  }
  const fh = runCargo(['run', '--locked', '-p', 'fake-harness', '--', '--self-test'], 900 * 1000);
  ok('fake-harness-stable-repeat', fh.code === 0, `fake-harness repeat exit=${fh.code}`);
} else {
  console.log(`RESULT=FAIL REASON=unknown-mode ${mode}`); process.exit(1);
}

if (failures.length > 0) {
  console.log(`MODE=${mode} FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL'); process.exit(1);
}
console.log(`RESULT=PASS MODE=${mode}`);
