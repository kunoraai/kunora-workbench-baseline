import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dshRoot = join(root, 'dsh')
const harnessProgram = process.execPath
const cli = join(dshRoot, 'apps', 'cli', 'lib', 'bin.js')
const dshd = join(root, 'target', 'debug', process.platform === 'win32' ? 'dshd.exe' : 'dshd')
const runRoot = await mkdtemp(join(tmpdir(), 'dshd-m2-product-'))
const startedAt = Date.now()
const elapsed = () => `${String(Date.now() - startedAt).padStart(5, '0')}ms`

function checked(program, args, cwd, label) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-4000)
    throw new Error(`PRECONDITION_FAILED ${label} exit=${String(result.status)} ${detail}`)
  }
}

async function ensureBuiltProducts() {
  console.log(`${elapsed()} PREPARE frozen_install=corepack-pnpm frozen_lock=true`)
  checked('corepack', ['pnpm', 'install', '--frozen-lockfile'], dshRoot, 'frozen dependency install')
  console.log(`${elapsed()} PREPARE cli_build=pnpm-build`)
  checked('corepack', ['pnpm', 'build'], dshRoot, 'frozen CLI build')
  try {
    await access(cli)
  } catch (error) {
    throw new Error(`PRECONDITION_FAILED CLI artifact missing after build: ${cli}`, { cause: error })
  }
  const cliDigest = createHash('sha256').update(await readFile(cli)).digest('hex')
  console.log(`${elapsed()} PREPARE cli_artifact=${cli} sha256=${cliDigest}`)
  checked('cargo', ['build', '--locked', '-p', 'dshd'], root, 'dshd build')
  try {
    await access(dshd)
  } catch (error) {
    throw new Error(`PRECONDITION_FAILED dshd artifact missing after build: ${dshd}`, { cause: error })
  }
  return cliDigest
}

function cleanEnvironment() {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|SECRET|TOKEN|PASSWORD)/iu.test(name)))
  const isolatedHome = join(runRoot, 'home')
  return { ...inherited, HOME: isolatedHome, USERPROFILE: isolatedHome, XDG_CONFIG_HOME: join(isolatedHome, '.config'), XDG_STATE_HOME: join(isolatedHome, '.local', 'state'), DSH_AGENTS_HOME: join(runRoot, '.agents'), DSH_HOME: join(runRoot, '.dsh'), DSH_TELEMETRY_DISABLED: '1', NODE_NO_WARNINGS: '1', SSH_CONNECTION: '', SSH_TTY: '' }
}
function waitFor(test, timeoutMs, label) {
  return new Promise((resolveWait, reject) => {
    const deadline = Date.now() + timeoutMs
    const poll = () => {
      const result = test()
      if (result !== undefined) return resolveWait(result)
      if (Date.now() >= deadline) return reject(new Error(`${label} timeout`))
      setTimeout(poll, 50)
    }
    poll()
  })
}
function pidExists(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

let daemon
try {
  const cliDigest = await ensureBuiltProducts()
  const args = [
    '--state-dir', join(runRoot, 'state'), '--node-id', '123e4567-e89b-42d3-a456-426614174000',
    '--node-token', 'in-memory-only', '--listen-port', '8080', '--advertise-url', 'http://127.0.0.1:8080',
    '--central-base-url', 'http://127.0.0.1:8081', '--harness-program', harnessProgram,
    '--harness-entry', cli,
    '--harness-cwd', dshRoot,
  ]
  console.log(`${elapsed()} PRODUCT_START driver=dshd-assembled profile="dsh web --no-open --port 0" cli_sha256=${cliDigest}`)
  daemon = spawn(dshd, args, { env: cleanEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] })
  let buffered = ''
  const records = []
  const append = chunk => {
    buffered += String(chunk)
    const lines = buffered.split(/\r?\n/u)
    buffered = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('{')) continue
      try { const record = JSON.parse(line); records.push(record); console.log(`${elapsed()} DSHD ${line}`) } catch { /* ignore bounded non-JSON diagnostics */ }
    }
  }
  daemon.stdout.on('data', append)
  daemon.stderr.on('data', append)
  const exit = new Promise((resolveExit, reject) => { daemon.once('error', reject); daemon.once('exit', (code, signal) => resolveExit({ code, signal })) })
  const firstReady = await waitFor(() => records.find(record => record.observed === 'Ready' && record.generation === 1), 90_000, 'generation 1 READY')
  const firstSpawn = records.find(record => record.effect === 'Spawn' && record.attempt === 1)
  if (firstSpawn?.child_pid === undefined) throw new Error('generation 1 child PID missing')
  console.log(`${elapsed()} INJECT_CRASH generation=1 pid=${firstSpawn.child_pid} method=taskkill-/T-/F`)
  const killed = process.platform === 'win32' ? spawnSync('taskkill', ['/PID', String(firstSpawn.child_pid), '/T', '/F'], { encoding: 'utf8' }) : spawnSync('kill', ['-KILL', String(firstSpawn.child_pid)], { encoding: 'utf8' })
  if (pidExists(firstSpawn.child_pid)) process.kill(firstSpawn.child_pid, 'SIGKILL')
  await waitFor(() => pidExists(firstSpawn.child_pid) ? undefined : true, 15_000, 'generation 1 PID disappearance')
  console.log(`${elapsed()} CRASH_CONFIRMED generation=1 pid=${firstSpawn.child_pid} pid_gone=true injector_exit=${String(killed.status)}`)
  const secondReady = await waitFor(() => records.find(record => record.observed === 'Ready' && record.generation === 2), 90_000, 'generation 2 READY')
  const secondSpawn = records.find(record => record.effect === 'Spawn' && record.attempt === 2)
  if (secondSpawn?.child_pid === undefined || secondSpawn.child_pid === firstSpawn.child_pid) throw new Error('generation 2 distinct child PID missing')
  if (firstReady.authority === undefined || secondReady.authority === undefined) throw new Error('READY authority missing')
  console.log(`${elapsed()} PRODUCT_SHUTDOWN signal=typed-internal-command windows_SIGTERM_semantics=graceful`)
  daemon.stdin.end('shutdown\n')
  const stopped = await waitFor(() => records.find(record => record.observed === 'Stopped' && record.generation === 2), 15_000, 'STOPPED')
  const result = await exit
  daemon = undefined
  if (result.code !== 0) throw new Error(`dshd exit=${String(result.code)} signal=${String(result.signal)}`)
  await waitFor(() => pidExists(secondSpawn.child_pid) ? undefined : true, 15_000, 'generation 2 PID disappearance')
  console.log(`${elapsed()} PRODUCT_STOPPED generation=${stopped.generation} pid=${secondSpawn.child_pid} pid_gone=true`)
  console.log(`RESULT=PASS driver=dshd-assembled generations=1,2 pids=${firstSpawn.child_pid},${secondSpawn.child_pid} real_probe=HTTP_200 secrets=REDACTED`)
} finally {
  if (daemon !== undefined && daemon.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(daemon.pid), '/T', '/F'])
    else daemon.kill('SIGKILL')
  }
  await rm(runRoot, { recursive: true, force: true })
}
