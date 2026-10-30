import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { FIXTURES, copyFixture, runScript } from './helpers.mjs'

const readiness = (root, ...extra) => runScript('readiness.mjs', ['asset-tracker', '--root', root, ...extra])
const line = (out, name) => out.split('\n').find((l) => l.includes(`** ${name} —`)) ?? ''

test('ready fixture passes every check', () => {
  const r = readiness(path.join(FIXTURES, 'ready'))
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.doesNotMatch(r.stdout, /FAIL/)
  assert.match(r.stdout, /PASS\*\* task skills/)
  assert.match(r.stdout, /\nReady to build: yes$/m)
})

test('not-ready fixture: open question, untagged AC, task cycle, unknown skill', () => {
  const r = readiness(path.join(FIXTURES, 'not-ready'))
  assert.equal(r.code, 1, r.stdout + r.stderr)
  assert.match(line(r.stdout, 'open questions'), /FAIL.*still open/)
  assert.match(line(r.stdout, 'acceptance criteria'), /FAIL.*missing \[verify: <tag>\]/)
  assert.match(line(r.stdout, 'task dependencies'), /FAIL.*cycle: T0[12] → T0[12] → T0[12]/)
  assert.match(line(r.stdout, 'task skills'), /FAIL.*T02: platform-made-up-skill/)
  assert.match(line(r.stdout, 'AC coverage'), /FAIL.*covers unknown ACs: T01→AC-2/)
  assert.match(line(r.stdout, 'ADRs'), /PASS/)
  assert.match(r.stdout, /Ready to build: no/)
})

test('--spec-only skips the task checks', () => {
  const r = readiness(path.join(FIXTURES, 'not-ready'), '--spec-only')
  assert.equal(r.code, 1)
  assert.doesNotMatch(r.stdout, /task (skills|dependencies)|tasks: not generated/)
})

test('no tasks dir: informational line, spec can still be ready', () => {
  const root = copyFixture('ready')
  fs.rmSync(path.join(root, 'architecture/specs/asset-tracker'), { recursive: true })
  const r = readiness(root)
  assert.equal(r.code, 0, r.stdout)
  assert.match(r.stdout, /_info_ tasks: not generated yet \(run \/sf-spec-tasks\)/)
})

test('placeholders, missing target-org, and a story without an AC fail', () => {
  const root = copyFixture('ready')
  const spec = path.join(root, 'architecture/specs/asset-tracker.md')
  fs.writeFileSync(spec, fs.readFileSync(spec, 'utf8').replace('target-org: fakeDev\n', '').replace('Procurement and depreciation.', 'TBD').replace(/^- AC-6 .*$/m, '').replace(/^- AC-5 .*$/m, ''))
  const r = readiness(root, '--spec-only')
  assert.equal(r.code, 1)
  assert.match(line(r.stdout, 'spec front matter'), /FAIL.*target-org: not set/)
  assert.match(line(r.stdout, 'no placeholders'), /FAIL/)
  assert.match(line(r.stdout, 'user stories'), /FAIL.*no AC for US-3/)
})

test('--write upserts the readiness block', () => {
  const root = copyFixture('ready')
  const r = readiness(root, '--write')
  assert.equal(r.code, 0)
  const card = fs.readFileSync(path.join(root, 'architecture/scorecards/asset-tracker.md'), 'utf8')
  assert.match(card, /<!-- sf-spec:readiness:start -->\n### Readiness — asset-tracker[\s\S]*Ready to build: yes\n<!-- sf-spec:readiness:end -->/)
  assert.match(card, /sf-spec:evidence:start[\s\S]*sf-spec:review:start/)
})

test('usage errors and a missing spec exit 2', () => {
  assert.equal(runScript('readiness.mjs', []).code, 2)
  assert.equal(runScript('readiness.mjs', ['Asset Tracker']).code, 2)
  assert.equal(runScript('readiness.mjs', ['asset-tracker', '--bogus']).code, 2)
  const r = readiness(path.join(FIXTURES, 'ready'), 'extra')
  assert.equal(r.code, 2)
  const missing = runScript('readiness.mjs', ['nope', '--root', path.join(FIXTURES, 'ready')])
  assert.equal(missing.code, 2)
  assert.match(missing.stderr, /no spec at architecture\/specs\/nope\.md/)
})
