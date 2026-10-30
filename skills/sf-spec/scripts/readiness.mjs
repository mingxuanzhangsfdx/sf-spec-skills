#!/usr/bin/env node
// Is the spec ready to build? Deterministic checks over architecture/ (see ../conventions.md).
// Usage: node readiness.mjs <feature> [--root <dir>] [--write] [--spec-only]
// Exit: 0 ready · 1 not ready · 2 usage error or missing spec.
import path from 'node:path'
import {
  FEATURE_SLUG, INTENT_SECTIONS, SPEC_SECTIONS, SPEC_STATUSES, TASK_FIELDS, TASK_STATUSES, UsageError, VERIFY_TAGS,
  exists, findSection, isMain, knownSkills, loadTasks, parseAdrs, parseArgs, parseIntent, parseSpec, readText, upsertScorecardBlock,
} from './lib.mjs'

const USAGE = 'usage: node readiness.mjs <feature> [--root <dir>] [--write] [--spec-only]'
const isNone = (body) => body === '' || /^[-*\s]*(none|n\/a)\.?$/i.test(body.trim())
const dupes = (ids) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

function intentChecks(arch) {
  const text = readText(path.join(arch, 'intent.md'))
  if (text == null) return [{ name: 'intent', ok: false, why: 'architecture/intent.md missing (run /sf-spec-grill)' }]
  const { sections } = parseIntent(text)
  const missing = INTENT_SECTIONS.filter((s) => !findSection(sections, s))
  const open = findSection(sections, 'Open questions')
  return [
    { name: 'intent sections', ok: !missing.length, why: missing.length ? `missing: ${missing.join(', ')}` : `all ${INTENT_SECTIONS.length} present` },
    { name: 'open questions', ok: !open || isNone(open.body), why: !open || isNone(open.body) ? 'none open' : `still open: ${open.body.split(/\r?\n/).filter((l) => l.trim()).length} line(s) — resolve with /sf-spec-grill` },
  ]
}

function adrChecks(arch) {
  const text = readText(path.join(arch, 'architectural-decisions.md'))
  if (text == null) return [{ name: 'ADRs', ok: false, why: 'architecture/architectural-decisions.md missing (run /sf-spec-grill)' }]
  const adrs = parseAdrs(text)
  const noReuse = adrs.filter((a) => !/reuse checked\s*\**\s*:/i.test(a.body)).map((a) => a.id)
  return [
    { name: 'ADRs', ok: adrs.length > 0, why: adrs.length ? `${adrs.length} recorded` : 'no "## ADR-NNN: <title>" entries' },
    ...(adrs.length ? [{ name: 'ADR reuse check', ok: !noReuse.length, why: noReuse.length ? `no "Reuse checked:" in ${noReuse.join(', ')}` : 'every ADR records what was checked for reuse' }] : []),
  ]
}

function specChecks(spec, feature) {
  const { fm } = spec
  const missing = SPEC_SECTIONS.filter((s) => !findSection(spec.sections, s))
  const empty = SPEC_SECTIONS.filter((s) => findSection(spec.sections, s)?.body === '')
  const usIds = spec.stories.map((s) => s.id)
  const acIds = spec.acs.map((a) => a.id)
  const servedBy = (us) => spec.acs.some((a) => a.stories.includes(us))
  const lonelyUs = usIds.filter((us) => !servedBy(us))
  const badRefs = spec.acs.flatMap((a) => (a.stories.length ? a.stories.filter((s) => !usIds.includes(s)).map((s) => `${a.id}→${s}`) : [`${a.id}→(none)`]))
  const badTags = spec.acs.filter((a) => !VERIFY_TAGS.includes(a.tag)).map((a) => `${a.id} [verify: ${a.tag || '?'}]`)
  const noGwt = spec.acs.filter((a) => !a.gwt).map((a) => a.id)
  const malformedAc = spec.malformed.filter((m) => m.kind === 'AC')
  const malformedUs = spec.malformed.filter((m) => m.kind === 'US')
  const fmProblems = [
    fm.feature !== feature && `feature: is "${fm.feature ?? ''}", expected "${feature}"`,
    !fm['target-org'] && 'target-org: not set',
    fm.status && !SPEC_STATUSES.includes(fm.status) && `status: "${fm.status}" not one of ${SPEC_STATUSES.join('|')}`,
  ].filter(Boolean)
  const lines = (ms) => ms.map((m) => `L${m.line} ${m.why}`).join('; ')
  return [
    { name: 'spec front matter', ok: !fmProblems.length, why: fmProblems.join('; ') || `feature ${feature}, target-org ${fm['target-org']}` },
    { name: 'spec sections', ok: !missing.length && !empty.length, why: [missing.length && `missing: ${missing.join(', ')}`, empty.length && `empty: ${empty.join(', ')}`].filter(Boolean).join('; ') || `all ${SPEC_SECTIONS.length} present` },
    { name: 'no placeholders', ok: !spec.placeholders.length, why: spec.placeholders.length ? spec.placeholders.slice(0, 5).map((p) => `L${p.line}`).join(', ') + ' contain TBD/TODO/???/[NEEDS CLARIFICATION' : 'none' },
    { name: 'user stories', ok: usIds.length > 0 && !dupes(usIds).length && !malformedUs.length && !lonelyUs.length,
      why: [!usIds.length && 'no "- US-n: As a …, I want …" bullets', dupes(usIds).length && `duplicate ids: ${dupes(usIds).join(', ')}`, malformedUs.length && lines(malformedUs), lonelyUs.length && `no AC for ${lonelyUs.join(', ')}`].filter(Boolean).join('; ') || `${usIds.length} stories, each with ≥1 AC` },
    { name: 'acceptance criteria', ok: acIds.length > 0 && !dupes(acIds).length && !malformedAc.length && !badRefs.length && !badTags.length && !noGwt.length,
      why: [!acIds.length && 'no "- AC-n (US-n): … [verify: tag]" bullets', dupes(acIds).length && `duplicate ids: ${dupes(acIds).join(', ')}`, malformedAc.length && lines(malformedAc),
        badRefs.length && `unknown story refs: ${badRefs.join(', ')}`, badTags.length && `verify tag not one of ${VERIFY_TAGS.join('|')}: ${badTags.join(', ')}`, noGwt.length && `not Given/When/Then: ${noGwt.join(', ')}`].filter(Boolean).join('; ') || `${acIds.length} ACs, all tagged` },
  ]
}

function findCycle(tasks) {
  const edges = new Map(tasks.map((t) => [t.id, t.blockedBy]))
  const state = new Map()
  const visit = (id, trail) => {
    if (state.get(id) === 'done' || !edges.has(id)) return null
    if (state.get(id) === 'active') return [...trail.slice(trail.indexOf(id)), id]
    state.set(id, 'active')
    for (const dep of edges.get(id)) {
      const c = visit(dep, [...trail, id])
      if (c) return c
    }
    state.set(id, 'done')
    return null
  }
  for (const t of tasks) {
    const c = visit(t.id, [])
    if (c) return c
  }
  return null
}

export function taskChecks(tasks, spec, root) {
  const acIds = spec.acs.map((a) => a.id)
  const ids = tasks.map((t) => t.id).filter(Boolean)
  const fmProblems = tasks.flatMap((t) => [
    ...TASK_FIELDS.filter((f) => !(f in t.fm) || (f !== 'blocked-by' && t.fm[f] === '')).map((f) => `${t.file}: no ${f}`),
    t.status && !TASK_STATUSES.includes(t.status) ? `${t.file}: status "${t.status}"` : null,
    !t.covers.length ? `${t.file}: covers nothing` : null,
  ].filter(Boolean))
  const uncovered = acIds.filter((ac) => !tasks.some((t) => t.covers.includes(ac)))
  const unknownAcs = tasks.flatMap((t) => t.covers.filter((c) => !acIds.includes(c)).map((c) => `${t.id}→${c}`))
  const badDeps = tasks.flatMap((t) => t.blockedBy.filter((d) => !ids.includes(d)).map((d) => `${t.id}→${d}`))
  const cycle = findCycle(tasks)
  const skills = knownSkills(root)
  const unknownSkills = tasks.flatMap((t) => t.skills.filter((s) => !skills.catalog.has(s) && !skills.project.has(s)).map((s) => `${t.id}: ${s}`))
  return [
    { name: 'task front matter', ok: !fmProblems.length && !dupes(ids).length, why: [...fmProblems, ...(dupes(ids).length ? [`duplicate ids: ${dupes(ids).join(', ')}`] : [])].join('; ') || `${tasks.length} tasks well-formed` },
    { name: 'AC coverage', ok: !uncovered.length && !unknownAcs.length, why: [uncovered.length && `no task covers ${uncovered.join(', ')}`, unknownAcs.length && `covers unknown ACs: ${unknownAcs.join(', ')}`].filter(Boolean).join('; ') || `all ${acIds.length} ACs covered` },
    { name: 'task dependencies', ok: !badDeps.length && !cycle, why: [badDeps.length && `unknown blocked-by: ${badDeps.join(', ')}`, cycle && `cycle: ${cycle.join(' → ')}`].filter(Boolean).join('; ') || 'acyclic' },
    { name: 'task skills', ok: !unknownSkills.length, why: unknownSkills.length ? `not in skill-catalog.md or .afv/skills/: ${unknownSkills.join(', ')}${skills.catalogFound ? '' : ' (skill-catalog.md not found)'}` : 'all known' },
  ]
}

export function checkReadiness({ root, feature, specOnly = false }) {
  const arch = path.join(root, 'architecture')
  const specFile = path.join(arch, 'specs', `${feature}.md`)
  const specText = readText(specFile)
  if (specText == null) return { missingSpec: true, specFile }
  const spec = parseSpec(specText)
  const checks = [...intentChecks(arch), ...adrChecks(arch), ...specChecks(spec, feature)]
  const notes = []
  if (!specOnly) {
    const tasksDir = path.join(arch, 'specs', feature, 'tasks')
    const tasks = loadTasks(tasksDir)
    if (tasks) checks.push(...taskChecks(tasks, spec, root))
    else notes.push('tasks: not generated yet (run /sf-spec-tasks)')
  }
  const ready = checks.every((c) => c.ok)
  const md = [
    `### Readiness — ${feature}`,
    '',
    ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] **${c.ok ? 'PASS' : 'FAIL'}** ${c.name} — ${c.why}`),
    ...notes.map((n) => `- [ ] _info_ ${n}`),
    '',
    `Ready to build: ${ready ? 'yes' : 'no'}`,
  ].join('\n')
  return { ready, checks, notes, md, specFile }
}

function main(argv) {
  let args
  try {
    args = parseArgs(argv, { values: ['root'], flags: ['write', 'spec-only'] })
    if (args._.length !== 1) throw new UsageError('expected exactly one <feature>')
    if (!FEATURE_SLUG.test(args._[0])) throw new UsageError(`feature "${args._[0]}" is not a kebab-case slug`)
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`)
    return 2
  }
  const root = path.resolve(args.root ?? process.cwd())
  const feature = args._[0]
  const r = checkReadiness({ root, feature, specOnly: !!args['spec-only'] })
  if (r.missingSpec) {
    console.error(`no spec at ${path.relative(root, r.specFile) || r.specFile} — run /sf-spec-specify first${exists(path.join(root, 'architecture')) ? '' : ' (no architecture/ dir under --root)'}`)
    return 2
  }
  console.log(r.md)
  if (args.write) console.log(`\nwrote readiness block → ${path.relative(root, upsertScorecardBlock(root, feature, 'readiness', r.md))}`)
  return r.ready ? 0 : 1
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2))
