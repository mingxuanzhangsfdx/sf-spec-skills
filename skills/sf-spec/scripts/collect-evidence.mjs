#!/usr/bin/env node
// Delivery evidence: run the standards gates, trace each AC to the tests that prove it,
// check task traceability, and decide SHIP / NOT READY. Tool output decides; nothing self-graded.
// Usage: node collect-evidence.mjs <feature> [--root <dir>] [--spec <path>] [--no-tasks] [--target-org <alias>] [--no-org] [--skip <gate,…>]
// Exit: 0 SHIP · 1 NOT READY · 2 usage error or missing spec.
import fs from 'node:fs'
import path from 'node:path'
import {
  FEATURE_SLUG, UsageError, acIdsIn, cell, exists, isMain, listFiles, loadTasks, parseArgs, parseJsonLoose, parseSpec,
  readJson, readText, run, shellQuote, tail, toPosix, upsertScorecardBlock, writeJson,
} from './lib.mjs'
import { guardOrg } from './org-guard.mjs'

const USAGE = 'usage: node collect-evidence.mjs <feature> [--root <dir>] [--spec <path>] [--no-tasks] [--target-org <alias>] [--no-org] [--skip <gate,…>]'
export const GATES = ['code-analyzer', 'apex-tests', 'lwc-jest', 'a11y', 'npm-audit', 'deployable']
const RAW_FILES = ['code-analyzer.json', 'apex-tests.json', 'jest.json', 'npm-audit.json', 'deploy-dry-run.json', 'org-guard.json', 'gates.json']
const PASSING = new Set(['PASS', 'N/A'])
const BLOCKING_AC = new Set(['FAILING', 'UNVERIFIED', 'NOT_RUN'])
// Which gates can produce the test evidence for each verify tag (conventions § Verify tags).
const EVIDENCE_GATES = { apex: ['apex-tests', 'lwc-jest'], jest: ['apex-tests', 'lwc-jest'], a11y: ['lwc-jest'] }
const JEST_TEST_FILE = /(^|\/)lwc\/[^/]+\/__tests__\/[^/]+\.js$/

const gate = (state, reason, extra = {}) => ({ state, reason, items: [], ...extra })

// ---------- Apex source classification ----------

// Comments → space, string literals → '' in one left-to-right pass, so `// don't` and 'http://x' both survive.
const stripApex = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'/g, (m) => (m[0] === "'" ? "''" : ' '))

/**
 * isTest: @IsTest/testMethod anywhere (kept out of the coverage denominator).
 * runnable: has a test *method* — a class-level @IsTest alone (a data factory) is not, and sf errors if it is passed to --class-names.
 * coverable: a class (not an interface/enum), so it can appear in coverage results.
 */
export function apexTestInfo(src) {
  const s = stripApex(src)
  const coverable = !/^\s*(?:@\w+(?:\s*\([^)]*\))?\s*|\b(?:public|private|global|protected|virtual|abstract|with|without|inherited|sharing)\b\s*)*(?:interface|enum)\b/i.test(s)
  let runnable = /\btestmethod\b/i.test(s)
  for (const m of s.matchAll(/@istest\b(?:\s*\([^)]*\))?/gi)) {
    const rest = s.slice(m.index + m[0].length).replace(/^(?:\s*@\w+(?:\s*\([^)]*\))?)*/, '')
    const end = rest.search(/[({;]/)
    if (!/\bclass\b/i.test(end < 0 ? rest : rest.slice(0, end))) runnable = true
  }
  return { isTest: runnable || /@istest\b/i.test(s), runnable, coverable }
}

// ---------- Gates ----------

function codeAnalyzerGate(ctx) {
  if (!ctx.files.length) return gate('N/A', 'no source in force-app')
  const out = path.join(ctx.outDir, 'code-analyzer.json')
  const { r, ...cmd } = ctx.exec(['sf', 'code-analyzer', 'run', '--workspace', '.', '--target', 'force-app', '--rule-selector', 'Recommended', '--output-file', out])
  if (r.missing) return gate('NOT_RUN', 'sf CLI not found', cmd)
  const j = readJson(out)
  if (!j?.violationCounts) return gate('NOT_RUN', `Code Analyzer wrote no results (is the code-analyzer plugin installed?): ${tail(r.stderr || r.stdout)}`, cmd)
  const c = j.violationCounts
  const top = (Array.isArray(j.violations) ? j.violations : []).filter((v) => v.severity <= 3).sort((a, b) => a.severity - b.severity).slice(0, 10).map((v) => {
    const loc = v.locations?.[v.primaryLocationIndex ?? 0] ?? {}
    const file = loc.file ? toPosix(path.relative(ctx.root, path.resolve(ctx.root, loc.file))) : '?'
    return { rule: v.rule, engine: v.engine, severity: v.severity, file, line: loc.startLine ?? null, message: v.message }
  })
  const blocking = (c.sev1 ?? 0) + (c.sev2 ?? 0)
  return gate(blocking ? 'FAIL' : 'PASS', `sev1 ${c.sev1 ?? 0} · sev2 ${c.sev2 ?? 0} · sev3 ${c.sev3 ?? 0} · sev4 ${c.sev4 ?? 0} · sev5 ${c.sev5 ?? 0} (gate: sev1+sev2 = 0)`, {
    ...cmd, counts: c, topViolations: top,
    items: top.map((v) => `sev${v.severity} ${v.engine}:${v.rule} — ${v.file}:${v.line ?? '?'} — ${v.message}`),
  })
}

function apexCoverage(res, prod) {
  if (!prod.length) return null
  const rows = (res.coverage?.coverage ?? []).filter((c) => prod.includes(c.name))
  const missing = prod.filter((n) => !rows.some((c) => c.name === n))
  const pct = (v) => Number(String(v ?? '').replace('%', ''))
  const lines = rows.reduce((n, c) => n + (Number(c.totalLines) || 0), 0)
  const covered = rows.reduce((n, c) => n + (Number(c.totalCovered) || 0), 0)
  const perClass = rows.map((c) => `${c.name} ${Number(c.totalLines) ? Math.round((100 * c.totalCovered) / c.totalLines) : pct(c.coveredPercent)}%`)
  if (lines > 0) return { percent: Math.round((1000 * covered) / lines) / 10, covered, lines, perClass, missing }
  const pcts = rows.map((c) => pct(c.coveredPercent)).filter(Number.isFinite)
  if (pcts.length) return { percent: Math.round((10 * pcts.reduce((a, b) => a + b, 0)) / pcts.length) / 10, perClass, missing }
  const summary = pct(res.summary?.testRunCoverage)
  return { percent: Number.isFinite(summary) ? summary : 0, perClass, missing: rows.length ? missing : [], source: Number.isFinite(summary) ? 'summary.testRunCoverage' : 'no coverage rows' }
}

function apexGate(ctx) {
  const classes = ctx.files.filter((f) => f.endsWith('.cls')).map((f) => ({ name: path.basename(f, '.cls'), ...apexTestInfo(readText(path.join(ctx.root, f)) ?? '') }))
  if (!classes.length) return gate('N/A', 'no Apex classes in force-app')
  const prod = classes.filter((c) => !c.isTest && c.coverable).map((c) => c.name)
  const runnable = classes.filter((c) => c.runnable).map((c) => c.name)
  const info = { productionClasses: prod, testClasses: classes.filter((c) => c.isTest).map((c) => c.name), runnableTestClasses: runnable }
  if (!info.testClasses.length) return gate('FAIL', 'no Apex tests', info)
  if (!runnable.length) return gate('FAIL', 'no runnable Apex test methods (only @IsTest helper classes)', info)
  const org = ctx.org()
  if (!org.ok) return gate('NOT_RUN', org.reason, info)
  const { r, ...cmd } = ctx.exec(['sf', 'apex', 'run', 'test', ...runnable.flatMap((n) => ['--class-names', n]), '--code-coverage', '--result-format', 'json', '--json', '--wait', '30', '--target-org', ctx.alias])
  if (r.missing) return gate('NOT_RUN', 'sf CLI not found', { ...info, ...cmd })
  const j = parseJsonLoose(r.stdout) // sf exits non-zero when tests fail but still prints the result
  ctx.save('apex-tests.json', j ?? { unparsedStdout: r.stdout, stderr: r.stderr })
  const res = j?.result
  if (!res || (!res.tests && !res.summary)) return gate('FAIL', `sf apex run test returned no results: ${j?.message ?? tail(r.stderr || r.stdout)}`, { ...info, ...cmd })
  const tests = (res.tests ?? []).map((t) => ({
    source: 'apex', name: t.FullName ?? `${t.ApexClass?.Name}.${t.MethodName}`, method: t.MethodName ?? String(t.FullName ?? '').split('.').pop(),
    passed: t.Outcome === 'Pass', failed: t.Outcome === 'Fail' || t.Outcome === 'CompileFail', outcome: t.Outcome, message: t.Message ?? null,
  }))
  ctx.tests.push(...tests)
  const passing = tests.length ? tests.filter((t) => t.passed).length : Number(res.summary?.passing ?? 0)
  const failing = tests.length ? tests.length - passing : Number(res.summary?.failing ?? 0)
  const target = Number(ctx.spec.fm['coverage-target'] ?? 75)
  const cov = apexCoverage(res, prod)
  const covOk = !cov || (cov.percent >= target && !cov.missing.length)
  const ok = passing > 0 && failing === 0 && covOk
  const covText = cov ? `coverage ${cov.percent}% of production classes (target ${target}%)` : 'no production classes to cover'
  return gate(ok ? 'PASS' : 'FAIL', `${passing} passed · ${failing} failed · ${covText}`, {
    ...info, ...cmd, passing, failing, coverage: cov, coverageTarget: target,
    items: [
      ...tests.filter((t) => !t.passed).slice(0, 10).map((t) => `${t.outcome ?? 'Fail'} ${t.name}${t.message ? ` — ${tail(t.message, 200)}` : ''}`),
      ...(cov?.perClass?.length ? [`per class: ${cov.perClass.join(', ')}`] : []),
      ...(cov?.missing?.length ? [`no coverage row (never executed?): ${cov.missing.join(', ')}`] : []),
    ],
  })
}

function jestGate(ctx) {
  const testFiles = ctx.files.filter((f) => JEST_TEST_FILE.test(f))
  if (!testFiles.length) return gate('N/A', 'no LWC Jest tests in force-app')
  const bin = path.join(ctx.root, 'node_modules', '.bin', 'sfdx-lwc-jest')
  if (!exists(bin)) return gate('NOT_RUN', 'node_modules/.bin/sfdx-lwc-jest missing — run npm install')
  const out = path.join(ctx.outDir, 'jest.json')
  const { r, ...cmd } = ctx.exec([bin, '--', '--json', `--outputFile=${out}`])
  const j = readJson(out)
  if (!j) return gate('FAIL', `jest wrote no results: ${tail(r.stderr || r.stdout)}`, cmd)
  ctx.jest = j
  for (const tr of j.testResults ?? []) {
    const file = ctx.rel(tr.name ?? tr.testFilePath ?? '')
    for (const a of tr.assertionResults ?? []) {
      ctx.tests.push({ source: 'jest', name: [...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' ') || a.fullName, file, passed: a.status === 'passed', failed: a.status === 'failed', a11y: ctx.a11yFiles.has(file) })
    }
  }
  const total = j.numTotalTests ?? 0
  const failed = j.numFailedTests ?? 0
  const failedSuites = (j.numFailedTestSuites ?? 0) + (j.numRuntimeErrorTestSuites ?? 0)
  const ok = total > 0 && failed === 0 && failedSuites === 0 && j.success !== false
  const brokenSuites = (j.testResults ?? []).filter((tr) => tr.status === 'failed' && !(tr.assertionResults ?? []).some((a) => a.status === 'failed'))
  return gate(ok ? 'PASS' : 'FAIL', `${j.numPassedTests ?? 0}/${total} passed · ${failed} failed · ${failedSuites} suite(s) failed`, {
    ...cmd, total, failed, failedSuites,
    items: [
      ...ctx.tests.filter((t) => t.source === 'jest' && t.failed).slice(0, 10).map((t) => `✗ ${t.file}: ${t.name}`),
      ...brokenSuites.slice(0, 5).map((tr) => `suite failed to run: ${ctx.rel(tr.name)} — ${tail(tr.message, 200)}`),
    ],
  })
}

function a11yGate(ctx, jest) {
  const comps = new Map()
  for (const f of ctx.files) {
    const m = f.match(/^(.*\/lwc\/([^/]+))\/[^/]+\.html$/)
    if (m) comps.set(m[1], m[2])
  }
  if (!comps.size) return gate('N/A', 'no LWC components with an HTML template')
  if (jest.state === 'NOT_RUN') return gate('NOT_RUN', `lwc-jest not run: ${jest.reason}`)
  const results = new Map((ctx.jest?.testResults ?? []).map((tr) => [ctx.rel(tr.name ?? ''), tr]))
  const problems = []
  for (const [dir, name] of comps) {
    const files = ctx.files.filter((f) => f.startsWith(`${dir}/__tests__/`) && ctx.a11yFiles.has(f))
    if (!files.length) problems.push(`${name}: no __tests__ file asserts toBeAccessible`)
    for (const f of files) {
      const tr = results.get(f)
      const as = tr?.assertionResults ?? []
      if (!tr) problems.push(`${name}: ${f} not in jest results`)
      else if (tr.status === 'failed' || !as.length || as.some((a) => a.status !== 'passed')) problems.push(`${name}: ${path.basename(f)} has failing or skipped tests`)
    }
  }
  return gate(problems.length ? 'FAIL' : 'PASS', `${comps.size - new Set(problems.map((p) => p.split(':')[0])).size}/${comps.size} templated components have a passing Sa11y test`, { components: [...comps.values()], items: problems })
}

function npmAuditGate(ctx) {
  if (!exists(path.join(ctx.root, 'package.json'))) return gate('N/A', 'no package.json')
  if (!exists(path.join(ctx.root, 'package-lock.json'))) return gate('NOT_RUN', 'no package-lock.json — run npm install')
  const { r, ...cmd } = ctx.exec(['npm', 'audit', '--audit-level=high', '--json'])
  if (r.missing) return gate('NOT_RUN', 'npm not found', cmd)
  const j = parseJsonLoose(r.stdout)
  ctx.save('npm-audit.json', j ?? { unparsedStdout: r.stdout, stderr: r.stderr })
  const v = j?.metadata?.vulnerabilities
  if (!v || j.error) return gate('NOT_RUN', `npm audit failed: ${j?.error?.summary ?? tail(r.stderr || r.stdout)}`, cmd)
  const bad = (v.high ?? 0) + (v.critical ?? 0)
  const worst = Object.entries(j.vulnerabilities ?? {}).filter(([, x]) => x.severity === 'high' || x.severity === 'critical').slice(0, 10)
  return gate(bad ? 'FAIL' : 'PASS', `critical ${v.critical ?? 0} · high ${v.high ?? 0} · moderate ${v.moderate ?? 0} · low ${v.low ?? 0} (gate: high+critical = 0)`, {
    ...cmd, vulnerabilities: v, items: worst.map(([name, x]) => `${x.severity} ${name}${x.isDirect ? ' (direct)' : ''}`),
  })
}

function deployGate(ctx) {
  if (!ctx.files.length) return gate('N/A', 'no source in force-app')
  const org = ctx.org()
  if (!org.ok) return gate('NOT_RUN', org.reason)
  const { r, ...cmd } = ctx.exec(['sf', 'project', 'deploy', 'start', '--dry-run', '--source-dir', 'force-app', '--target-org', ctx.alias, '--test-level', 'NoTestRun', '--wait', '30', '--json'])
  if (r.missing) return gate('NOT_RUN', 'sf CLI not found', cmd)
  const j = parseJsonLoose(r.stdout)
  ctx.save('deploy-dry-run.json', j ?? { unparsedStdout: r.stdout, stderr: r.stderr })
  const res = j?.result ?? j?.data
  const ok = res?.success === true || (j?.status === 0 && res != null && res.success !== false)
  const failures = [
    ...[].concat(res?.details?.componentFailures ?? []).map((f) => ({ fullName: f.fullName, type: f.componentType, problem: f.problem })),
    ...(res?.files ?? []).filter((f) => f.state === 'Failed').map((f) => ({ fullName: f.fullName, type: f.type, problem: f.error })),
  ].filter((f, i, all) => all.findIndex((g) => g.fullName === f.fullName && g.problem === f.problem) === i)
  const reason = ok ? `dry-run deploy succeeded${res?.id ? ` (${res.id})` : ''}` : failures.length ? `${failures.length} component failure(s)` : `dry-run deploy failed: ${j?.message ?? tail(r.stderr || r.stdout)}`
  return gate(ok ? 'PASS' : 'FAIL', reason, { ...cmd, deployId: res?.id ?? null, componentFailures: failures, items: failures.slice(0, 10).map((f) => `${f.type ?? ''} ${f.fullName}: ${f.problem}`.trim()) })
}

// ---------- AC evidence, traceability, verdict ----------

export function classifyAcs(acs, tests, gates, tasks) {
  return acs.map((ac) => {
    const refs = tests.filter((t) => acIdsIn(t.source === 'apex' ? t.method : t.name).includes(ac.id))
    const cite = refs.map((t) => `${t.passed ? '✓' : t.failed ? '✗' : '–'} ${t.name}`)
    const out = (state, why, more = []) => ({ id: ac.id, tag: ac.tag, state, why, cite: [...cite, ...more] })
    if (refs.some((t) => t.failed)) return out('FAILING', 'a test citing it fails')
    if (ac.tag === 'manual') return out('MANUAL', 'needs a human check')
    if (ac.tag === 'deploy') {
      const d = gates.deployable
      const task = tasks?.find((t) => t.status === 'done' && t.covers.includes(ac.id))
      if (d.state === 'PASS' && task) return out('DEPLOYED', `deploys cleanly; delivered by ${task.id}`, task.deliveredPaths.slice(0, 3))
      if (d.state === 'PASS' && !tasks) return out('DEPLOYED', 'deploys cleanly (no tasks, so no delivered file to cite)')
      if (d.state === 'NOT_RUN') return out('NOT_RUN', `deployable not run: ${d.reason}`)
      return out('UNVERIFIED', d.state !== 'PASS' ? `deployable is ${d.state}` : 'no done task covers it, so no delivered file to cite')
    }
    if (refs.some((t) => t.passed && (ac.tag !== 'a11y' || t.a11y))) return out('VERIFIED', ac.tag === 'a11y' ? 'passing Sa11y test cites it' : 'passing test cites it')
    const notRun = (EVIDENCE_GATES[ac.tag] ?? []).filter((g) => gates[g]?.state === 'NOT_RUN')
    if (notRun.length) return out('NOT_RUN', `${notRun.join(', ')} not run`)
    if (!EVIDENCE_GATES[ac.tag]) return out('UNVERIFIED', `unknown verify tag "${ac.tag}"`)
    return out('UNVERIFIED', !refs.length ? 'no test name cites it' : ac.tag === 'a11y' ? 'citing tests are not toBeAccessible tests' : 'citing tests did not pass')
  })
}

export function traceability(files, tasks, acs, root) {
  if (!tasks) return { skipped: true, note: 'no tasks: traceability skipped' }
  const delivered = [...new Set(tasks.flatMap((t) => t.deliveredPaths).map((p) => p.replace(/\/+$/, '')))]
  const claimed = (f) => delivered.some((p) => f === p || f.startsWith(`${p}/`))
  const ignored = (f) => /(^|\/)(jsconfig\.json|\.eslintrc\.json)$/.test(f) || /(^|\/)__snapshots__\//.test(f)
  return {
    skipped: false,
    delivered,
    untraced: files.filter((f) => !ignored(f) && !claimed(f) && !(f.endsWith('-meta.xml') && claimed(f.slice(0, -'-meta.xml'.length)))),
    missingDelivered: delivered.filter((p) => !exists(path.join(root, p))),
    notDone: tasks.filter((t) => t.status !== 'done').map((t) => `${t.id ?? t.file} (${t.status || 'no status'})`),
    uncoveredAcs: acs.map((a) => a.id).filter((id) => !tasks.some((t) => t.covers.includes(id))),
  }
}

function render(r) {
  const { feature, gates, acs, trace, verdict, reasons, headline } = r
  const lines = [
    `### Delivery evidence — ${feature}`,
    '',
    `**${headline}**`,
    '',
    `_Collected ${r.collectedAt} · spec \`${r.specDisplay}\` · org ${r.orgSummary} · raw evidence in \`${r.outDisplay}/\`_`,
    '',
    '#### Standards gates',
    '',
    '| Gate | State | Result |',
    '|---|---|---|',
    ...Object.entries(gates).map(([n, g]) => `| ${n} | ${g.state} | ${cell(g.reason)} |`),
  ]
  const detailed = Object.entries(gates).filter(([, g]) => g.items.length)
  if (detailed.length) lines.push('', ...detailed.flatMap(([n, g]) => [`- **${n}**`, ...g.items.map((i) => `  - ${i}`)]))
  const ran = Object.entries(gates).filter(([, g]) => g.command)
  if (ran.length) lines.push('', '<details><summary>Commands run</summary>', '', ...ran.map(([n, g]) => `- ${n}: \`${g.command}\``), '', '</details>')
  lines.push('', '#### Acceptance criteria', '', '| AC | Verify | State | Evidence |', '|---|---|---|---|')
  lines.push(...acs.map((a) => `| ${a.id} | ${a.tag} | ${a.state} | ${cell([a.why, ...a.cite].join(' · '))} |`))
  if (!acs.length) lines.push('| — | — | — | no parseable ACs in the spec |')
  lines.push('', '#### Traceability', '')
  if (trace.skipped) lines.push(`- ${trace.note}`)
  else {
    lines.push(`- Untraced files (no task's \`## Delivered\` claims them — possible scope creep): ${trace.untraced.length ? '' : 'none'}`, ...trace.untraced.map((f) => `  - \`${f}\``))
    lines.push(`- Tasks not done: ${trace.notDone.join(', ') || 'none'}`)
    lines.push(`- ACs no task covers: ${trace.uncoveredAcs.join(', ') || 'none'}`)
    if (trace.missingDelivered.length) lines.push(`- Delivered paths that no longer exist: ${trace.missingDelivered.map((p) => `\`${p}\``).join(', ')}`)
  }
  lines.push('', `#### Verdict: ${verdict}`, '')
  lines.push(...(reasons.length ? reasons.map((x) => `- ${x}`) : ['- every applicable gate passes and every AC is verified']))
  const manual = acs.filter((a) => a.state === 'MANUAL')
  if (manual.length) lines.push('', `Needs human check: ${manual.map((a) => a.id).join(', ')}`)
  return lines.join('\n')
}

export function collectEvidence({ root: rootIn, feature, specFile, targetOrg, noOrg = false, noTasks = false, skip = [] }) {
  const root = fs.realpathSync(rootIn) // jest reports realpaths (macOS /var → /private/var)
  const spec = parseSpec(readText(specFile))
  // Tasks live next to the spec (specs/<feature>/tasks/); --no-tasks ignores them, e.g. when scoring a plain-chat checkout against another project's spec.
  const tasks = noTasks ? null : loadTasks(path.join(path.dirname(specFile), path.basename(specFile, '.md'), 'tasks'))
  const outDir = path.join(root, 'architecture', 'scorecards', feature)
  fs.mkdirSync(outDir, { recursive: true })
  for (const f of RAW_FILES) fs.rmSync(path.join(outDir, f), { force: true })
  const rel = (p) => toPosix(path.relative(root, p))
  const files = listFiles(path.join(root, 'force-app')).map((f) => `force-app/${f}`)
  let org
  const ctx = {
    root, outDir, spec, files, rel, alias: targetOrg ?? spec.fm['target-org'] ?? null, tests: [], jest: null,
    a11yFiles: new Set(files.filter((f) => JEST_TEST_FILE.test(f) && /toBeAccessible/.test(readText(path.join(root, f)) ?? ''))),
    save: (name, data) => writeJson(path.join(outDir, name), data),
    exec: (argv) => ({ r: run(argv[0], argv.slice(1), { cwd: root }), argv, command: shellQuote(argv.map((a) => a.split(`${root}${path.sep}`).join(''))) }),
    // Resolved once, and only when an org gate is about to run: org-guard before any org command.
    org: () => (org ??= (() => {
      if (noOrg) return { ok: false, reason: 'no org: --no-org' }
      if (!ctx.alias) return { ok: false, reason: 'no org: set target-org in the spec front matter or pass --target-org' }
      const { commands, ...g } = guardOrg(ctx.alias, { cwd: root })
      ctx.orgGuard = g
      ctx.save('org-guard.json', g)
      if (g.error) return { ok: false, reason: `org-guard: ${g.error}` }
      if (g.production) return { ok: false, reason: `refusing: production org (${g.username ?? ctx.alias})` }
      return { ok: true, reason: `${ctx.alias} (${[g.orgType, g.isSandbox && 'sandbox', g.isScratch && 'scratch'].filter(Boolean).join(', ')})` }
    })()),
  }
  const runners = { 'code-analyzer': codeAnalyzerGate, 'apex-tests': apexGate, 'lwc-jest': jestGate, a11y: (c, g) => a11yGate(c, g['lwc-jest']), 'npm-audit': npmAuditGate, deployable: deployGate }
  const gates = {}
  for (const name of GATES) gates[name] = skip.includes(name) ? gate('NOT_RUN', 'skipped (--skip)') : runners[name](ctx, gates)
  const acs = classifyAcs(spec.acs, ctx.tests, gates, tasks)
  const trace = traceability(files, tasks, spec.acs, root)
  const reasons = [
    ...Object.entries(gates).filter(([, g]) => !PASSING.has(g.state)).map(([n, g]) => `${n}: ${g.state} — ${g.reason}`),
    ...acs.filter((a) => BLOCKING_AC.has(a.state)).map((a) => `${a.id}: ${a.state} — ${a.why}`),
    ...(!spec.acs.length ? ['spec has no parseable acceptance criteria'] : []),
    ...(trace.notDone?.length ? [`tasks not done: ${trace.notDone.join(', ')}`] : []),
  ]
  const verdict = reasons.length ? 'NOT READY' : 'SHIP'
  const applicable = Object.values(gates).filter((g) => g.state !== 'N/A')
  const count = (s) => acs.filter((a) => a.state === s).length
  const headline = `Standards: ${applicable.filter((g) => g.state === 'PASS').length}/${applicable.length} gates passing (N/A excluded) · Spec: ${count('VERIFIED')}/${acs.length} ACs verified by tests, ${count('DEPLOYED')} deploy-verified, ${count('MANUAL')} manual · Untraced files: ${trace.skipped ? 'n/a (no tasks)' : trace.untraced.length} · Verdict: ${verdict}`
  const specRel = path.relative(root, specFile)
  const result = {
    feature, collectedAt: new Date().toISOString(), root, specFile, specDisplay: specRel.startsWith('..') ? specFile : toPosix(specRel), outDisplay: rel(outDir),
    targetOrg: ctx.alias, orgGuard: ctx.orgGuard ?? null, orgSummary: org ? (org.ok ? org.reason : `not used (${org.reason})`) : 'not needed',
    gates, acs, trace, verdict, reasons, headline,
  }
  result.md = render(result)
  writeJson(path.join(outDir, 'gates.json'), (({ md, ...rest }) => rest)(result))
  return result
}

function main(argv) {
  let args, root
  try {
    args = parseArgs(argv, { values: ['root', 'spec', 'target-org', 'skip'], flags: ['no-org', 'no-tasks'] })
    if (args._.length !== 1) throw new UsageError('expected exactly one <feature>')
    if (!FEATURE_SLUG.test(args._[0])) throw new UsageError(`feature "${args._[0]}" is not a kebab-case slug`)
    args.skipList = (args.skip ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const bad = args.skipList.filter((s) => !GATES.includes(s))
    if (bad.length) throw new UsageError(`unknown gate(s) in --skip: ${bad.join(', ')} (gates: ${GATES.join(', ')})`)
    if (!exists(path.resolve(args.root ?? '.'))) throw new UsageError(`--root ${args.root} does not exist`)
    root = fs.realpathSync(path.resolve(args.root ?? '.'))
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`)
    return 2
  }
  const feature = args._[0]
  const specFile = args.spec ? path.resolve(args.spec) : path.join(root, 'architecture', 'specs', `${feature}.md`)
  if (!exists(specFile)) {
    console.error(`no spec at ${specFile} — run /sf-spec-specify first, or pass --spec <path>`)
    return 2
  }
  const r = collectEvidence({ root, feature, specFile, targetOrg: args['target-org'], noOrg: !!args['no-org'], noTasks: !!args['no-tasks'], skip: args.skipList })
  console.log(r.md)
  const card = upsertScorecardBlock(root, feature, 'evidence', r.md)
  console.log(`\nwrote evidence block → ${path.relative(root, card)} · gates.json + raw tool output → ${r.outDisplay}/`)
  return r.verdict === 'SHIP' ? 0 : 1
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2))
