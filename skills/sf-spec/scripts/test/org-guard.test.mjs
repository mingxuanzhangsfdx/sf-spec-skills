import assert from 'node:assert/strict'
import { test } from 'node:test'
import { devOrg, fakeTools, prodOrg, runScript } from './helpers.mjs'

const guard = (scenario) => {
  const r = runScript('org-guard.mjs', ['fakeDev'], { env: fakeTools(scenario).env })
  return { ...r, json: JSON.parse(r.stdout) }
}

test('Developer Edition is safe (exit 0)', () => {
  const r = guard(devOrg)
  assert.equal(r.code, 0)
  assert.deepEqual(r.json, { alias: 'fakeDev', username: 'admin@fake-dev.example', instanceUrl: 'https://fake-dev-ed.develop.my.salesforce.com', orgType: 'Developer Edition', isSandbox: false, isScratch: false, production: false })
})

test('sandbox and scratch orgs are safe', () => {
  const sandbox = structuredClone(prodOrg)
  sandbox['org-query'].result.records[0].IsSandbox = true
  assert.equal(guard(sandbox).code, 0)
  const scratch = structuredClone(prodOrg)
  scratch['org-query'].result.records[0].TrialExpirationDate = '2026-11-28'
  scratch['org-display'].result.devHubId = 'devhub@acme.example'
  assert.equal(guard(scratch).json.isScratch, true)
  assert.equal(guard(scratch).code, 0)
})

test('production org exits 3', () => {
  const r = guard(prodOrg)
  assert.equal(r.code, 3)
  assert.equal(r.json.production, true)
})

test('unknown alias exits 2 with the sf error', () => {
  const r = guard({})
  assert.equal(r.code, 2)
  assert.match(r.json.error, /No authorization information found/)
  assert.equal(runScript('org-guard.mjs', []).code, 2)
})
