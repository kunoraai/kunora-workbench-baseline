#!/usr/bin/env node
// M1 实现（m1-impl-r1）机械验收器 —— 冻结于基线提交。
// 用法：
//   node tools/check-m1-impl-r1.mjs --mode structural --baseline <40hex> --six <sha> --plan <sha> --dplan <sha>
//   node tools/check-m1-impl-r1.mjs --mode cargo-check
//   node tools/check-m1-impl-r1.mjs --mode cargo-test
//   node tools/check-m1-impl-r1.mjs --mode drift
//   node tools/check-m1-impl-r1.mjs --mode selftests
// 任一模式全部通过输出 RESULT=PASS 且退出码 0；否则输出 RESULT=FAIL 与失败清单且退出码 1。
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) {
    console.log(`RESULT=FAIL REASON=missing-arg ${name}`);
    process.exit(1);
  }
  return args[i + 1];
}
const mode = argOf('--mode');

// cargo 解析：PATH 优先，回退 %USERPROFILE%\.cargo\bin
function cargoBin() {
  const probe = (cmd) => {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    return r.status === 0 ? cmd : null;
  };
  return probe('cargo') || probe(join(homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo'));
}
function runCargo(cargoArgs, timeoutMs) {
  const bin = cargoBin();
  if (!bin) return { code: -1, out: 'cargo not resolvable (PATH and ~/.cargo/bin)' };
  const r = spawnSync(bin, cargoArgs, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PATH: `${process.env.PATH || ''}${process.platform === 'win32' ? ';' : ':'}${join(homedir(), '.cargo', 'bin')}`, CARGO_TERM_COLOR: 'never' },
  });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}`.slice(-4000) };
}
function git(...rest) {
  return execFileSync('git', rest, { encoding: 'utf8' }).trim();
}
function blobSha(rev, path) {
  const buf = execFileSync('git', ['show', `${rev}:${path}`]);
  return createHash('sha256').update(buf).digest('hex');
}

const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
};

const FROZEN = {
  'docs/milestones/m1/six-elements.md': null,
  'docs/milestones/m1/overall-plan.md': null,
  'docs/milestones/m1/detailed-plan.md': null,
};

if (mode === 'structural') {
  const baseline = argOf('--baseline');
  const expected = {
    'docs/milestones/m1/six-elements.md': argOf('--six'),
    'docs/milestones/m1/overall-plan.md': argOf('--plan'),
    'docs/milestones/m1/detailed-plan.md': argOf('--dplan'),
  };
  // 1. 工作区干净（仅允许未跟踪 PROMPT.md）
  const status = git('status', '--porcelain').split('\n').filter(Boolean);
  const dirty = status.filter((l) => l !== '?? PROMPT.md');
  ok('worktree-clean', dirty.length === 0, `dirty=[${dirty.join(' | ')}]`);
  // 2. 全部提交身份一致
  const authors = git('log', `${baseline}..HEAD`, '--format=%an <%ae>').split('\n').filter(Boolean);
  ok('commits-exist', authors.length > 0, 'no commits ahead of baseline');
  const badAuthors = authors.filter((a) => a !== 'Remote Agent <agent@remote.kunora.ai>');
  ok('commit-authors', badAuthors.length === 0, `non-conforming=[${badAuthors.join('; ')}]`);
  // 3. 变更路径白名单
  const changed = git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean);
  const allowedFiles = new Set([
    'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', '.gitignore', '.gitattribute', '.gitattributes',
    'rustfmt.toml', '.rustfmt.toml', 'clippy.toml', 'Dockerfile', '.dockerignore', 'deny.toml',
  ]);
  const allowedPrefixes = ['crates/', 'tools/', 'tests/', '.github/', 'docker/', 'scripts/', 'docs/milestones/m1/'];
  const forbiddenExact = new Set(['tools/check-m1-plan.mjs', 'tools/check-m1-impl-r1.mjs']);
  const bad = changed.filter((p) => forbiddenExact.has(p) || !(allowedFiles.has(p) || allowedPrefixes.some((pre) => p.startsWith(pre))));
  ok('diff-whitelist', bad.length === 0, `out-of-scope=[${bad.join(', ')}]`);
  // 4. 冻结文档不可变
  for (const [path, exp] of Object.entries(expected)) {
    let baseSha = '';
    let headSha = '';
    try {
      baseSha = blobSha(baseline, path);
      headSha = blobSha('HEAD', path);
    } catch (e) {
      ok(`frozen[${path}]`, false, String(e.message).slice(0, 80));
      continue;
    }
    ok(`frozen[${path}]`, baseSha === exp && headSha === exp, `baseline=${baseSha.slice(0, 12)} head=${headSha.slice(0, 12)}`);
  }
  // 5. 工具链锁定文件
  const toolchain = existsSync('rust-toolchain.toml') ? readFileSync('rust-toolchain.toml', 'utf8') : '';
  ok('rust-toolchain-exists', toolchain.length > 0, 'rust-toolchain.toml missing');
  ok('rust-toolchain-pinned', /^\s*channel\s*=\s*"[0-9]+\.[0-9]+(\.[0-9]+)?"/m.test(toolchain), 'channel must be a concrete numeric version');
  ok('cargo-lock-exists', existsSync('Cargo.lock'), 'Cargo.lock missing');
  // 6. CI 工作流
  const gh = existsSync('.github/workflows');
  let workflowFiles = [];
  if (gh) workflowFiles = execFileSync('git', ['ls-files', '.github/workflows'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  ok('ci-workflow-exists', workflowFiles.length > 0, '.github/workflows has no yml');
  const wfAll = workflowFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  ok('ci-runs-validator', wfAll.includes('validate_contracts.py'), 'workflow must invoke validate_contracts.py');
  ok('ci-quality-jobs', ['clippy', 'fmt'].every((k) => wfAll.toLowerCase().includes(k)), 'workflow must contain clippy and fmt jobs');
  ok('ci-locked', wfAll.includes('--locked'), 'workflow cargo commands must use --locked');
  // 7. Docker skeleton
  const dockerfile = existsSync('Dockerfile') ? readFileSync('Dockerfile', 'utf8') : '';
  ok('dockerfile-exists', dockerfile.length > 0, 'Dockerfile missing');
  ok('dockerfile-rust-builder', /FROM\s+[^\n]*rust/i.test(dockerfile), 'dshd builder stage FROM rust missing');
  ok('dockerfile-node24', /FROM\s+[^\n]*node[^\n]*(24|:24)/i.test(dockerfile), 'harness builder FROM node:24 missing');
  ok('dockerfile-tini', /tini/i.test(dockerfile), 'tini missing');
  ok('dockerfile-flock', /flock/i.test(dockerfile), 'flock (util-linux) missing');
  // 8. 报告与出口记录骨架
  const reports = execFileSync('git', ['ls-files', 'docs/milestones/m1'], { encoding: 'utf8' }).split('\n').filter((f) => f.startsWith('docs/milestones/m1/reports/') && f.endsWith('.md'));
  ok('reports-count', reports.length >= 4, `reports/*.md count=${reports.length}, expected >=4 (T01/T02/T03+T04/T05)`);
  const exitRecPath = 'docs/milestones/m1/exit-record.md';
  const exitRec = existsSync(exitRecPath) ? readFileSync(exitRecPath, 'utf8') : '';
  ok('exit-record-skeleton', exitRec.length > 0 && ['AC-01', 'AC-07', 'declared=66', 'executed=0'].every((k) => exitRec.includes(k)), 'exit-record.md skeleton missing required keys');
  ok('exit-record-pending-honesty', /PENDING/i.test(exitRec), 'exit record must mark CI-dependent evidence as PENDING');
} else if (mode === 'cargo-check') {
  const r = runCargo(['check', '--workspace', '--all-targets', '--locked'], 1500 * 1000);
  ok('cargo-check', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
} else if (mode === 'cargo-test') {
  const r = runCargo(['test', '--workspace', '--locked'], 1800 * 1000);
  ok('cargo-test', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
  ok('cargo-test-zero-fail', !/(test result: FAILED|error\[|error: could not compile)/.test(r.out), 'compile/test failure markers present');
} else if (mode === 'drift') {
  const r = runCargo(['test', '-p', 'dshd-contract', '--test', 'drift_gate', '--locked'], 1200 * 1000);
  ok('drift-gate-tests', r.code === 0, `exit=${r.code} tail=${r.out.slice(-300)}`);
  ok('drift-negative-present', r.out.includes('drift') && /ok\./.test(r.out), 'drift_gate test target must pass');
} else if (mode === 'selftests') {
  const bins = [
    { pkg: 'conformance-runner', versionOut: true, declaredZero: true },
    { pkg: 'fake-harness', versionOut: true },
    { pkg: 'reference-stub', versionOut: true },
    { pkg: 'capability-report', versionOut: true },
  ];
  for (const b of bins) {
    const v = runCargo(['run', '--locked', '-p', b.pkg, '--', '--version'], 900 * 1000);
    ok(`${b.pkg}-version`, v.code === 0 && /[0-9]+\.[0-9]+\.[0-9]+/.test(v.out), `exit=${v.code} out=${v.out.slice(0, 120)}`);
    const s = runCargo(['run', '--locked', '-p', b.pkg, '--', '--self-test'], 900 * 1000);
    ok(`${b.pkg}-selftest`, s.code === 0, `exit=${s.code} tail=${s.out.slice(-200)}`);
    if (b.declaredZero) {
      ok(`${b.pkg}-declared66`, s.out.includes('declared=66'), 'output must contain declared=66');
      ok(`${b.pkg}-executed0`, s.out.includes('executed=0'), 'output must contain executed=0');
    }
  }
} else {
  console.log(`RESULT=FAIL REASON=unknown-mode ${mode}`);
  process.exit(1);
}

if (failures.length > 0) {
  console.log(`MODE=${mode} FAILURES=${failures.length}`);
  for (const f of failures) console.log('FAIL: ' + f);
  console.log('RESULT=FAIL');
  process.exit(1);
}
console.log(`RESULT=PASS MODE=${mode}`);
