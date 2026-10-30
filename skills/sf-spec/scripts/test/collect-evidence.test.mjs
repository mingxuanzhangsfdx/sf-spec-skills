import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { addLwcTests, allPass, apexOneFails, copyFixture, fakeTools, prodOrg, runScript, write } from './helpers.mjs'

function collect(scenario, { args = [], setup } = {}) {
  const root = copyFixture('ready')
  addLwcTests(root)
  setup?.(root)
  const fake = fakeTools(scenario, root)
  const r = runScript('collect-evidence.mjs', ['asset-tracker', '--root', root, ...args], { env: fake.env })
  const gates = JSON.parse(fs.readFileSync(path.join(root, 'architecture/scorecards/asset-tracker/gates.json'), 'utf8'))
  const ac = (id) => gates.acs.find((a) => a.id === id)
  return { root, r, gates, ac, calls: fake.calls() }
}
const sfCalls = (calls, sub) => calls.filter((c) => c[0] === 'sf' && c.slice(1, 3).join(' ') === sub)

test('all gates pass, every AC proven → SHIP', () => {
  const { r, gates, ac, calls, root } = collect(allPass)
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.equal(gates.verdict, 'SHIP')
  for (const [name, g] of Object.entries(gates.gates)) assert.equal(g.state, 'PASS', `${name}: ${g.reason}`)
  assert.deepEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6'].map((id) => ac(id).state), ['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'DEPLOYED', 'MANUAL'])
  assert.match(ac('AC-1').cite.join(), /LaptopServiceTest\.ac1AssignAvailableLaptop/)
  assert.deepEqual(gates.trace.untraced, [])
  assert.equal(gates.gates['apex-tests'].coverage.percent, 90)
  assert.match(r.stdout, /Standards: 6\/6 gates passing \(N\/A excluded\) · Spec: 4\/6 ACs verified by tests, 1 deploy-verified, 1 manual · Untraced files: 0 · Verdict: SHIP/)
  assert.match(r.stdout, /Needs human check: AC-6/)
  // org-guard ran before any org command
  const firstOrgCmd = calls.findIndex((c) => c[0] === 'sf' && ['apex run', 'project deploy'].includes(c.slice(1, 3).join(' ')))
  assert.ok(sfCalls(calls, 'org display').length === 1 && calls.findIndex((c) => c[1] === 'org') < firstOrgCmd)
  const card = fs.readFileSync(path.join(root, 'architecture/scorecards/asset-tracker.md'), 'utf8')
  assert.match(card, /<!-- sf-spec:evidence:start -->\n### Delivery evidence — asset-tracker/)
  for (const f of ['code-analyzer.json', 'apex-tests.json', 'jest.json', 'npm-audit.json', 'deploy-dry-run.json', 'org-guard.json']) assert.ok(fs.existsSync(path.join(root, 'architecture/scorecards/asset-tracker', f)), f)
})

test('@IsTest data factory is not passed to --class-names and stays out of coverage', () => {
  const { gates, calls } = collect(allPass)
  const [apex] = sfCalls(calls, 'apex run')
  const classNames = apex.flatMap((a, i) => (apex[i - 1] === '--class-names' ? [a] : []))
  assert.deepEqual(classNames, ['LaptopServiceTest'])
  assert.deepEqual(gates.gates['apex-tests'].productionClasses, ['LaptopService'])
  assert.deepEqual(gates.gates['apex-tests'].testClasses.sort(), ['LaptopServiceTest', 'LaptopTestFactory'])
})

test('only a data factory, no test methods → apex-tests FAIL without calling sf', () => {
  const { gates, calls } = collect(allPass, { setup: (root) => fs.rmSync(path.join(root, 'force-app/main/default/classes/LaptopServiceTest.cls')) })
  assert.equal(gates.gates['apex-tests'].state, 'FAIL')
  assert.match(gates.gates['apex-tests'].reason, /no runnable Apex test methods/)
  assert.equal(sfCalls(calls, 'apex run').length, 0)
})

test('a failing Apex test marks its AC FAILING', () => {
  const { r, gates, ac } = collect({ ...allPass, apex: apexOneFails })
  assert.equal(r.code, 1)
  assert.equal(gates.gates['apex-tests'].state, 'FAIL')
  assert.equal(ac('AC-2').state, 'FAILING')
  assert.match(ac('AC-2').cite.join(), /✗ LaptopServiceTest\.ac2RejectRetiredLaptop/)
  assert.equal(ac('AC-1').state, 'VERIFIED')
  assert.match(gates.gates['apex-tests'].items.join(), /Assertion Failed/)
  assert.equal(gates.verdict, 'NOT READY')
})

test('--no-org: org gates NOT_RUN, no org commands, ACs that need Apex are NOT_RUN', () => {
  const { r, gates, ac, calls } = collect(allPass, { args: ['--no-org'] })
  assert.equal(r.code, 1)
  assert.equal(gates.gates['apex-tests'].state, 'NOT_RUN')
  assert.equal(gates.gates.deployable.state, 'NOT_RUN')
  assert.match(gates.gates.deployable.reason, /--no-org/)
  assert.equal(calls.filter((c) => c[0] === 'sf' && c[1] !== 'code-analyzer').length, 0)
  assert.equal(ac('AC-1').state, 'NOT_RUN')
  assert.equal(ac('AC-5').state, 'NOT_RUN')
  assert.equal(ac('AC-3').state, 'VERIFIED')
  assert.equal(gates.gates['code-analyzer'].state, 'PASS')
})

test('unknown alias: org-guard error → org gates NOT_RUN', () => {
  const { gates } = collect({ ...allPass, 'org-display': null })
  assert.equal(gates.gates['apex-tests'].state, 'NOT_RUN')
  assert.match(gates.gates['apex-tests'].reason, /org-guard: .*No authorization information/)
})

test('production org: refuse, never run tests or deploy', () => {
  const { gates, calls } = collect({ ...allPass, ...prodOrg })
  for (const g of ['apex-tests', 'deployable']) {
    assert.equal(gates.gates[g].state, 'NOT_RUN')
    assert.match(gates.gates[g].reason, /refusing: production org/)
  }
  assert.equal(sfCalls(calls, 'apex run').length + sfCalls(calls, 'project deploy').length, 0)
  assert.equal(gates.orgGuard.production, true)
})

test('a file no task delivered is untraced and blocks nothing else', () => {
  const { gates, r } = collect(allPass, { setup: (root) => write(root, 'force-app/main/default/classes/Extra.cls-meta.xml', '<x/>') })
  assert.deepEqual(gates.trace.untraced, ['force-app/main/default/classes/Extra.cls-meta.xml'])
  assert.match(r.stdout, /Untraced files: 1 · /)
  assert.match(r.stdout, /`force-app\/main\/default\/classes\/Extra\.cls-meta\.xml`/)
})

test('a templated component without a Sa11y test fails a11y; the a11y AC is unverified', () => {
  const { gates, ac } = collect(allPass, {
    setup: (root) => fs.rmSync(path.join(root, 'force-app/main/default/lwc/myLaptops/__tests__/myLaptops.accessibility.test.js')),
  })
  assert.equal(gates.gates.a11y.state, 'FAIL')
  assert.match(gates.gates.a11y.items.join(), /myLaptops: no __tests__ file asserts toBeAccessible/)
  assert.equal(ac('AC-4').state, 'UNVERIFIED')
})

test('--spec scores another checkout (no architecture/) against a spec; --no-tasks skips traceability', () => {
  const spec = copyFixture('ready')
  const checkout = copyFixture('ready')
  fs.rmSync(path.join(checkout, 'architecture'), { recursive: true })
  addLwcTests(checkout)
  const fake = fakeTools(allPass, checkout)
  const r = runScript('collect-evidence.mjs', ['asset-tracker', '--root', checkout, '--spec', path.join(spec, 'architecture/specs/asset-tracker.md'), '--no-tasks'], { env: fake.env })
  assert.equal(r.code, 0, r.stdout + r.stderr)
  const gates = JSON.parse(fs.readFileSync(path.join(checkout, 'architecture/scorecards/asset-tracker/gates.json'), 'utf8'))
  assert.equal(gates.trace.skipped, true)
  assert.match(r.stdout, /- no tasks: traceability skipped/)
  assert.match(r.stdout, /Untraced files: n\/a \(no tasks\) · Verdict: SHIP/)
  assert.equal(gates.acs.find((a) => a.id === 'AC-5').state, 'DEPLOYED')
  assert.ok(fs.existsSync(path.join(checkout, 'architecture/scorecards/asset-tracker.md')))
})

test('--skip marks a gate NOT_RUN; bad args exit 2', () => {
  const { gates } = collect(allPass, { args: ['--skip', 'npm-audit'] })
  assert.equal(gates.gates['npm-audit'].state, 'NOT_RUN')
  assert.equal(gates.verdict, 'NOT READY')
  assert.equal(runScript('collect-evidence.mjs', ['asset-tracker', '--skip', 'nope']).code, 2)
  assert.equal(runScript('collect-evidence.mjs', []).code, 2)
  assert.equal(runScript('collect-evidence.mjs', ['asset-tracker', '--root', '/nonexistent-sf-spec']).code, 2)
})
