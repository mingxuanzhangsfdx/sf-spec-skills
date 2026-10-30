// Test harness: copy a fixture project to a temp dir and put fake `sf` / `npm` / `sfdx-lwc-jest`
// shims first on PATH. Shims answer from scenario JSON and log every call to calls.log.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SCRIPTS = path.resolve(here, '..')
export const FIXTURES = path.join(here, 'fixtures')

export function copyFixture(name) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `sf-spec-${name}-`)))
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true })
  return dir
}

export const write = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}

// One shim script serves every fake binary; it switches on its own basename.
const SHIM = `#!/usr/bin/env node
const fs = require('fs'), path = require('path')
const dir = process.env.FAKE_DIR, argv = process.argv.slice(2), bin = path.basename(process.argv[1])
fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify([bin, ...argv]) + '\\n')
const load = (n) => { const f = path.join(dir, n + '.json'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('<ROOT>').join(process.cwd()) : null }
const flag = (name) => { const i = argv.indexOf(name); if (i >= 0) return argv[i + 1]; const a = argv.find((x) => x.startsWith(name + '=')); return a && a.slice(name.length + 1) }
const reply = (n, fallback) => { const t = load(n); if (t == null) { console.log(JSON.stringify(fallback)); process.exit(1) } console.log(t); process.exit(JSON.parse(t).status ? 1 : 0) }
const cmd = argv.slice(0, 2).join(' ')
if (bin === 'sfdx-lwc-jest') { fs.writeFileSync(flag('--outputFile'), load('jest')); process.exit(0) }
if (bin === 'npm' && argv[0] === 'audit') { console.log(load('npm-audit')); process.exit(0) }
if (cmd === 'code-analyzer run') { fs.writeFileSync(flag('--output-file'), load('code-analyzer')); process.exit(0) }
if (cmd === 'org display') reply('org-display', { status: 1, name: 'NoAuthInfoFound', message: 'No authorization information found for ' + flag('--target-org') })
if (cmd === 'data query') reply('org-query', { status: 1, message: 'query failed' })
if (cmd === 'apex run') reply('apex', { status: 1, message: 'no apex fixture' })
if (cmd === 'project deploy') reply('deploy', { status: 1, message: 'no deploy fixture' })
console.error('fake ' + bin + ': unhandled ' + argv.join(' ')); process.exit(64)
`

/** Fake binaries + scenario responses. `root` gets node_modules/.bin/sfdx-lwc-jest when given. */
export function fakeTools(scenario, root) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-spec-fake-')))
  const bin = path.join(dir, 'bin')
  fs.mkdirSync(bin)
  for (const name of ['sf', 'npm']) fs.writeFileSync(path.join(bin, name), SHIM, { mode: 0o755 })
  if (root) {
    fs.mkdirSync(path.join(root, 'node_modules', '.bin'), { recursive: true })
    fs.writeFileSync(path.join(root, 'node_modules', '.bin', 'sfdx-lwc-jest'), SHIM, { mode: 0o755 })
  }
  for (const [name, data] of Object.entries(scenario)) if (data != null) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2))
  const env = { ...process.env, FAKE_DIR: dir, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  const calls = () => (fs.existsSync(path.join(dir, 'calls.log')) ? fs.readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
  return { dir, env, calls }
}

export function runScript(script, args, { env = process.env, cwd } = {}) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { env, cwd, encoding: 'utf8' })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

// ---------- Scenario responses (shapes match sf CLI 2.x / Code Analyzer v5 / Jest 29 / npm 10 --json output) ----------

export const devOrg = {
  'org-display': { status: 0, result: { username: 'admin@fake-dev.example', instanceUrl: 'https://fake-dev-ed.develop.my.salesforce.com', alias: 'fakeDev', connectedStatus: 'Connected' } },
  'org-query': { status: 0, result: { totalSize: 1, done: true, records: [{ Id: '00DFAKE', Name: 'Fake Dev', OrganizationType: 'Developer Edition', IsSandbox: false, TrialExpirationDate: null }] } },
}
export const prodOrg = {
  'org-display': { status: 0, result: { username: 'admin@acme.example', instanceUrl: 'https://acme.my.salesforce.com', alias: 'fakeDev' } },
  'org-query': { status: 0, result: { totalSize: 1, done: true, records: [{ Id: '00DPROD', Name: 'Acme', OrganizationType: 'Enterprise Edition', IsSandbox: false, TrialExpirationDate: null }] } },
}

export const codeAnalyzerClean = {
  runDir: '<ROOT>/',
  violationCounts: { total: 1, sev1: 0, sev2: 0, sev3: 1, sev4: 0, sev5: 0 },
  versions: { 'code-analyzer': '0.52.0' },
  violations: [{ rule: 'ApexDoc', engine: 'pmd', severity: 3, tags: ['Documentation'], primaryLocationIndex: 0, locations: [{ file: '<ROOT>/force-app/main/default/classes/LaptopService.cls', startLine: 1, startColumn: 1 }], message: 'Missing ApexDoc comment', resources: [] }],
}

const apexTest = (method, outcome = 'Pass', message = null) => ({ FullName: `LaptopServiceTest.${method}`, MethodName: method, ApexClass: { Name: 'LaptopServiceTest' }, Outcome: outcome, Message: message })
export const apexPass = {
  status: 0,
  result: {
    summary: { outcome: 'Passed', testsRan: 2, passing: 2, failing: 0, testRunCoverage: '90%' },
    tests: [apexTest('ac1AssignAvailableLaptop'), apexTest('ac2RejectRetiredLaptop')],
    coverage: { coverage: [{ id: '01p1', name: 'LaptopService', totalLines: 10, totalCovered: 9, coveredPercent: 90 }] },
  },
}
export const apexOneFails = {
  status: 100,
  result: {
    summary: { outcome: 'Failed', testsRan: 2, passing: 1, failing: 1, testRunCoverage: '90%' },
    tests: [apexTest('ac1AssignAvailableLaptop'), apexTest('ac2RejectRetiredLaptop', 'Fail', 'System.AssertException: Assertion Failed: expected rejection')],
    coverage: { coverage: [{ id: '01p1', name: 'LaptopService', totalLines: 10, totalCovered: 9, coveredPercent: 90 }] },
  },
}

const lwcTests = '<ROOT>/force-app/main/default/lwc/myLaptops/__tests__'
export const jestPass = {
  success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numFailedTestSuites: 0, numRuntimeErrorTestSuites: 0,
  testResults: [
    { name: `${lwcTests}/myLaptops.test.js`, status: 'passed', assertionResults: [{ ancestorTitles: ['c-my-laptops'], title: 'AC-3: lists only my laptops', fullName: 'c-my-laptops AC-3: lists only my laptops', status: 'passed' }] },
    { name: `${lwcTests}/myLaptops.accessibility.test.js`, status: 'passed', assertionResults: [{ ancestorTitles: ['c-my-laptops'], title: 'AC-4: has no Sa11y violations', fullName: 'c-my-laptops AC-4: has no Sa11y violations', status: 'passed' }] },
  ],
}

export const npmAuditClean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 2, moderate: 0, high: 0, critical: 0, total: 2 } } }
export const deployOk = { status: 0, result: { success: true, id: '0AfFAKE000002', status: 'Succeeded', checkOnly: true, files: [] } }

export const allPass = { ...devOrg, 'code-analyzer': codeAnalyzerClean, apex: apexPass, jest: jestPass, 'npm-audit': npmAuditClean, deploy: deployOk }

/** The LWC Jest test files the scenarios describe (kept out of the fixture tree so no test runner discovers them). */
export function addLwcTests(root) {
  const dir = 'force-app/main/default/lwc/myLaptops/__tests__'
  write(root, `${dir}/myLaptops.test.js`, "import { createElement } from 'lwc'\nit('AC-3: lists only my laptops', () => {})\n")
  write(root, `${dir}/myLaptops.accessibility.test.js`, "it('AC-4: has no Sa11y violations', async () => { await expect(document.body).toBeAccessible() })\n")
}
