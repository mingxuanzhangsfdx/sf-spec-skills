import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { acIdsIn, deliveredPaths, parseFrontMatter, parseJsonLoose, parseSpec, parseTask, upsertScorecardBlock } from '../lib.mjs'
import { apexTestInfo } from '../collect-evidence.mjs'

test('acIdsIn: camelCase Apex names, Jest titles, no false hits inside words', () => {
  assert.deepEqual(acIdsIn('ac1Ac2Foo'), ['AC-1', 'AC-2'])
  assert.deepEqual(acIdsIn('MacBook3'), [])
  assert.deepEqual(acIdsIn('AC-10: x'), ['AC-10'])
  assert.deepEqual(acIdsIn('ac3AssignSetsAssignee'), ['AC-3'])
  assert.deepEqual(acIdsIn('ac1_ac2_legacy'), ['AC-1', 'AC-2'])
  assert.deepEqual(acIdsIn('c-my-laptops AC-4: has no Sa11y violations'), ['AC-4'])
  assert.deepEqual(acIdsIn('trac3 ac12'), ['AC-12'])
})

test('parseJsonLoose skips CLI warnings printed before the JSON', () => {
  assert.deepEqual(parseJsonLoose('Warning: update available {x}\n{"status":0,"result":{"a":1}}\n'), { status: 0, result: { a: 1 } })
  assert.equal(parseJsonLoose('no json here'), null)
})

test('parseFrontMatter drops trailing comments on unquoted values', () => {
  const { fm } = parseFrontMatter('---\nstatus: draft   # draft | ready\ntitle: "a # b"\n---\nbody')
  assert.deepEqual(fm, { status: 'draft', title: 'a # b' })
})

test('parseSpec reads stories, tagged ACs, and reports malformed AC lines', () => {
  const spec = parseSpec([
    '---', 'feature: x', '---',
    '## User Stories', '- US-1: As an admin, I want a thing, so that it works.',
    '## Acceptance Criteria',
    '- AC-1 (US-1): Given a, when b, then c. [verify: apex]',
    '- AC-2 (US-1): Given a, when b, then c.',
    '- **AC-3** (US-1, US-2): Given a, when b, then c. [verify: a11y]',
  ].join('\n'))
  assert.deepEqual(spec.stories.map((s) => s.id), ['US-1'])
  assert.deepEqual(spec.acs.map((a) => [a.id, a.tag, a.stories]), [['AC-1', 'apex', ['US-1']], ['AC-3', 'a11y', ['US-1', 'US-2']]])
  assert.equal(spec.malformed.length, 1)
  assert.match(spec.malformed[0].why, /missing \[verify/)
  assert.equal(spec.malformed[0].line, 8)
})

test('deliveredPaths and parseTask', () => {
  assert.deepEqual(deliveredPaths('- `force-app/a/B.cls`, force-app/c/.\n- (force-app/d/E.xml): ok'), ['force-app/a/B.cls', 'force-app/c/', 'force-app/d/E.xml'])
  const t = parseTask('---\nid: T01\ntitle: x\nskills: a, b\ncovers: AC-1, ac2\nblocked-by: none\nstatus: Done\n---\n## Delivered\n- force-app/x.cls\n', '01-x.md')
  assert.deepEqual([t.skills, t.covers, t.blockedBy, t.status, t.deliveredPaths], [['a', 'b'], ['AC-1', 'AC-2'], [], 'done', ['force-app/x.cls']])
})

test('apexTestInfo: @IsTest data factories are test code but not runnable', () => {
  const factory = fs.readFileSync(new URL('./fixtures/ready/force-app/main/default/classes/LaptopTestFactory.cls', import.meta.url), 'utf8')
  assert.deepEqual(apexTestInfo(factory), { isTest: true, runnable: false, coverable: true })
  assert.equal(apexTestInfo('@isTest(SeeAllData=false)\nprivate class T {\n  @IsTest(SeeAllData=false)\n  static void a() {}\n}').runnable, true)
  assert.equal(apexTestInfo('public class T { static testMethod void a() {} }').runnable, true)
  assert.equal(apexTestInfo('@IsTest public class F { @TestSetup static void s() {} }').runnable, false)
  assert.deepEqual(apexTestInfo("public with sharing class S { // @IsTest\n String s = '@IsTest'; }"), { isTest: false, runnable: false, coverable: true })
  assert.equal(apexTestInfo('public interface I { void x(); }').coverable, false)
})

test('upsertScorecardBlock creates the three blocks, then replaces only the named one', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-spec-card-'))
  const file = upsertScorecardBlock(root, 'f', 'readiness', 'R1')
  const created = fs.readFileSync(file, 'utf8')
  assert.match(created, /^# Scorecard: f\n/)
  assert.ok(created.indexOf('sf-spec:readiness:start') < created.indexOf('sf-spec:evidence:start'))
  assert.ok(created.indexOf('sf-spec:evidence:start') < created.indexOf('sf-spec:review:start'))
  assert.match(created, /_Spec review not written yet — run \/sf-spec-score\._/)
  fs.writeFileSync(file, created.replace('# Scorecard: f', () => '# Scorecard: f\n\nHand-written note $& $1.') + '\nTrailing note.\n')
  upsertScorecardBlock(root, 'f', 'evidence', 'E1 with $& and $1')
  upsertScorecardBlock(root, 'f', 'readiness', 'R2')
  const after = fs.readFileSync(file, 'utf8')
  assert.match(after, /Hand-written note \$& \$1\./)
  assert.match(after, /Trailing note\./)
  assert.match(after, /readiness:start -->\nR2\n/)
  assert.match(after, /evidence:start -->\nE1 with \$& and \$1\n/)
  assert.doesNotMatch(after, /R1/)
  assert.match(after, /_Spec review not written yet/)
})
