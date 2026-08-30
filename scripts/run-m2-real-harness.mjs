import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dshRoot = join(root, 'dsh')
const cli = join(dshRoot, 'apps', 'cli', 'lib', 'bin.js')
const runRoot = await mkdtemp(join(tmpdir(), 'dshd-m2-real-'))
const startedAt = Date.now()

function elapsed() {
  return `${String(Date.now() - startedAt).padStart(5, '0')}ms`
}

function cleanEnvironment() {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/(?:KEY|SECRET|TOKEN|PASSWORD)/iu.test(name)))
  return {
    ...inherited,
    DSH_AGENTS_HOME: join(runRoot, '.agents'),
    DSH_HOME: join(runRoot, '.dsh'),
    DSH_TELEMETRY_DISABLED: '1',
    NODE_NO_WARNINGS: '1',
    SSH_CONNECTION: '',
    SSH_TTY: '',
  }
}

async function startGeneration(generation) {
  const child = spawn(process.execPath, [cli, 'web', '--no-open', '--port', '0'], {
    cwd: dshRoot,
    env: cleanEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const launchUrl = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error('readiness timeout')), 90_000)
    const append = (chunk) => {
      output = `${output}${String(chunk)}`.slice(-100_000)
      const match = /dsh web: (http:\/\/[^\s]+)/u.exec(output)
      if (match?.[1] === undefined) return
      clearTimeout(timer)
      resolveReady(match[1])
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`exited before readiness (${String(code)})`)))
  })
  const url = new URL(launchUrl)
  console.log(`${elapsed()} AUTHENTICATING generation=${generation} pid=${child.pid} authority=${url.host}`)
  const exchange = await fetch(url, { redirect: 'manual' })
  const setCookie = exchange.headers.get('set-cookie')
  if (exchange.status !== 303 || setCookie === null) throw new Error(`exchange failed status=${exchange.status}`)
  const cookie = setCookie.split(';', 1)[0]
  const body = JSON.stringify({
    type: 'client-request',
    rpcId: `m2-real-${generation}`,
    method: 'settings/describe',
    payload: { args: {} },
  })
  const probe = await fetch(new URL('/api/settings/describe', url), {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body,
  })
  const probeBody = await probe.text()
  if (probe.status !== 200 || !probeBody.includes('server-response')) {
    throw new Error(`probe failed status=${probe.status}`)
  }
  console.log(`${elapsed()} READY generation=${generation} pid=${child.pid} exchange=303 cookie_count=1`)
  console.log(`${elapsed()} probe_status=HTTP_200 generation=${generation} rpc=server-response`)
  return child
}

async function waitGone(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listing = spawnSync('tasklist', ['/FI', `PID eq ${child.pid}`, '/NH'], { encoding: 'utf8' })
    if (!listing.stdout.includes(String(child.pid))) {
      child.stdout.destroy()
      child.stderr.destroy()
      child.unref()
      return
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 50))
  }
  throw new Error(`process disappearance timeout pid=${child.pid}`)
}

let current
try {
  console.log(`${elapsed()} STARTING generation=1 profile="dsh web --no-open --port 0"`)
  current = await startGeneration(1)
  const firstPid = current.pid
  const killed = spawnSync('taskkill', ['/PID', String(firstPid), '/T', '/F'], { encoding: 'utf8' })
  await waitGone(current, 15_000)
  current = undefined
  console.log(`${elapsed()} CRASHED generation=1 pid=${firstPid} pid_gone=true method=taskkill-/T-/F taskkill_exit=${String(killed.status)}`)
  console.log(`${elapsed()} BACKOFF delay=1000ms`)
  await new Promise(resolveDelay => setTimeout(resolveDelay, 1_000))
  console.log(`${elapsed()} STARTING generation=2`)
  current = await startGeneration(2)
  const secondPid = current.pid
  current.kill('SIGTERM')
  await waitGone(current, 15_000)
  current = undefined
  console.log(`${elapsed()} STOPPED generation=2 pid=${secondPid} pid_gone=true signal=SIGTERM`)
  console.log('RESULT=PASS generations=1,2 real_probe=HTTP_200 secrets=REDACTED')
} finally {
  if (current !== undefined && current.exitCode === null) {
    spawnSync('taskkill', ['/PID', String(current.pid), '/T', '/F'])
  }
  await rm(runRoot, { recursive: true, force: true })
}
