// Shared helpers for the sf-spec scripts: parse the architecture/ markdown
// contract (see ../conventions.md), run CLIs, and upsert scorecard blocks.
// Node >= 18, built-ins only.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SPEC_SECTIONS = ['Problem Statement', 'Solution', 'User Stories', 'Acceptance Criteria', 'Data Model', 'Security Model', 'Observability', 'Definition of Done', 'Out of Scope']
export const INTENT_SECTIONS = ['Problem', 'Users', 'Outcomes', 'Constraints', 'Non-goals', 'Open questions']
export const SPEC_STATUSES = ['draft', 'ready', 'building', 'delivered']
export const VERIFY_TAGS = ['apex', 'jest', 'a11y', 'deploy', 'manual']
export const TASK_FIELDS = ['id', 'title', 'skills', 'covers', 'blocked-by', 'status']
export const TASK_STATUSES = ['todo', 'in-progress', 'done', 'blocked']
export const SCORECARD_BLOCKS = ['readiness', 'evidence', 'review']
export const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class UsageError extends Error {}

export const readText = (file) => {
  try { return fs.readFileSync(file, 'utf8') } catch { return null }
}
export const readJson = (file) => {
  const t = readText(file)
  try { return t == null ? null : JSON.parse(t) } catch { return null }
}
export const exists = (p) => fs.existsSync(p)
export const writeJson = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
export const toPosix = (p) => p.split(path.sep).join('/')
export const tail = (s, n = 300) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(-n)
export const cell = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
export const shellQuote = (argv) => argv.map((a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ')

/** True when the calling module is the script node was started with (symlink-safe). */
export function isMain(metaUrl) {
  try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(metaUrl)) } catch { return false }
}

/** `--key value` / `--key=value` for `values`, bare `--flag` for `flags`; anything else is a UsageError. */
export function parseArgs(argv, { values = [], flags = [] } = {}) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { out._.push(a); continue }
    const [key, inline] = a.slice(2).split(/=(.*)/s)
    if (values.includes(key)) {
      const v = inline ?? argv[++i]
      if (v === undefined || v.startsWith('--')) throw new UsageError(`--${key} needs a value`)
      out[key] = v
    } else if (flags.includes(key) && inline === undefined) out[key] = true
    else throw new UsageError(`unknown option --${key}`)
  }
  return out
}

/** spawnSync with an args array and no shell. `missing` means the binary was not found. */
export function run(cmd, args, { cwd, env } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: env ?? process.env, encoding: 'utf8', shell: false, maxBuffer: 256 * 1024 * 1024 })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', missing: r.error?.code === 'ENOENT', error: r.error?.message }
}

/** sf CLI can print warnings before its JSON; try each line-leading `{`, then the first `{`. */
export function parseJsonLoose(stdout) {
  const t = String(stdout ?? '')
  const starts = [...t.matchAll(/(^|\n)\{/g)].map((m) => m.index + m[1].length)
  if (t.indexOf('{') >= 0) starts.push(t.indexOf('{'))
  for (const i of starts) {
    try { return JSON.parse(t.slice(i)) } catch {}
    try { return JSON.parse(t.slice(i, t.lastIndexOf('}') + 1)) } catch {}
  }
  return null
}

/** Flat `key: value` front matter; unquoted values drop a trailing ` # comment`. */
export function parseFrontMatter(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return { fm: {}, body: text, offset: 0 }
  const fm = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!kv) continue
    let v = kv[2].trim()
    v = /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v.replace(/(^|\s+)#.*$/, '').trim()
    fm[kv[1]] = v
  }
  return { fm, body: text.slice(m[0].length), offset: (m[0].match(/\n/g) ?? []).length }
}

/** `##` sections (ignoring fenced code), each with its body and 1-based file line numbers. */
export function parseSections(body, offset = 0) {
  const sections = []
  let cur = null
  let fence = false
  body.split(/\r?\n/).forEach((text, i) => {
    const line = i + 1 + offset
    if (/^\s*(```|~~~)/.test(text)) fence = !fence
    const h = !fence && text.match(/^##\s+(.+?)\s*#*\s*$/)
    if (h) sections.push((cur = { title: h[1].trim(), line, lines: [] }))
    else if (cur) cur.lines.push({ text, line })
  })
  return sections.map((s) => ({ ...s, body: s.lines.map((l) => l.text).join('\n').trim() }))
}

export const findSection = (sections, title) => sections.find((s) => s.title.toLowerCase() === title.toLowerCase())

const normId = (prefix) => (s) => {
  const m = String(s).trim().match(new RegExp(`^\\**${prefix}[-_ ]?(\\d+)\\**$`, 'i'))
  return m ? `${prefix}-${Number(m[1])}` : String(s).trim()
}
export const normAC = normId('AC')
export const normUS = normId('US')

// Conventions § Test naming: no letter right before `ac`, so `ac1Ac2…` yields both ids and `MacBook` none.
const AC_REF = /(?<![A-Za-z])ac[-_]?(\d+)(?![0-9])/gi
/** AC ids a test name claims to prove, e.g. `ac1Ac2AssignLaptop` → ['AC-1', 'AC-2']. */
export const acIdsIn = (name) => [...new Set([...String(name ?? '').matchAll(AC_REF)].map((m) => `AC-${Number(m[1])}`))]

const US_LINE = /^\s*[-*]\s+\**US-(\d+)\**\s*:\s*(.+)$/i
const US_LIKE = /^\s*[-*]\s+\**US[-_ ]?\d+/i
const AC_LINE = /^\s*[-*]\s+\**AC-(\d+)\**\s*\(([^)]*)\)\s*:\s*(.*?)\s*\[verify:\s*([A-Za-z0-9_-]*)\s*\]\s*\.?\s*$/i
const AC_LIKE = /^\s*[-*]\s+\**AC[-_ ]?\d+/i
const PLACEHOLDER = /\bTBD\b|\bTODO\b|\?\?\?|\[NEEDS CLARIFICATION/

export function parseSpec(text) {
  const { fm, body, offset } = parseFrontMatter(text)
  const sections = parseSections(body, offset)
  const stories = []
  const acs = []
  const malformed = []
  for (const { text: t, line } of findSection(sections, 'User Stories')?.lines ?? []) {
    const m = t.match(US_LINE)
    if (m && /\bas an?\b/i.test(m[2]) && /\bi want\b/i.test(m[2])) stories.push({ id: `US-${Number(m[1])}`, text: m[2].trim(), line })
    else if (US_LIKE.test(t)) malformed.push({ kind: 'US', line, text: t.trim(), why: 'expected "- US-n: As a <role>, I want <capability>, so that <benefit>."' })
  }
  for (const { text: t, line } of findSection(sections, 'Acceptance Criteria')?.lines ?? []) {
    if (!AC_LIKE.test(t)) continue
    const m = t.match(AC_LINE)
    if (!m) {
      const why = /\[verify:/i.test(t) ? 'expected "- AC-n (US-n): Given …, when …, then …. [verify: <tag>]"' : 'missing [verify: <tag>]'
      malformed.push({ kind: 'AC', line, text: t.trim(), why })
      continue
    }
    const gwt = /\bgiven\b/i.test(m[3]) && /\bwhen\b/i.test(m[3]) && /\bthen\b/i.test(m[3])
    const refs = m[2].split(',').map((s) => s.trim()).filter(Boolean).map(normUS)
    acs.push({ id: `AC-${Number(m[1])}`, stories: refs, tag: m[4].toLowerCase(), text: m[3].trim(), line, gwt })
  }
  const placeholders = text.split(/\r?\n/).flatMap((t, i) => (PLACEHOLDER.test(t) ? [{ line: i + 1, text: t.trim() }] : []))
  return { fm, sections, stories, acs, malformed, placeholders }
}

export function parseIntent(text) {
  const { fm, body, offset } = parseFrontMatter(text)
  return { fm, sections: parseSections(body, offset) }
}

export function parseAdrs(text) {
  const { body, offset } = parseFrontMatter(text)
  return parseSections(body, offset).flatMap((s) => {
    const m = s.title.match(/^ADR-(\d+)\s*:\s*(.+)$/i)
    return m ? [{ id: `ADR-${m[1]}`, title: m[2], line: s.line, body: s.body }] : []
  })
}

/** Source paths named in a task's `## Delivered` section (files or directories under force-app/). */
export const deliveredPaths = (s) => [...new Set([...String(s).matchAll(/force-app\/[^\s`'"),\]*|<>]+/g)].map((m) => m[0].replace(/[.:]+$/, '')))]

export function parseTask(text, file) {
  const { fm, body, offset } = parseFrontMatter(text)
  const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== 'none')
  const sections = parseSections(body, offset)
  return {
    file,
    fm,
    id: fm.id,
    title: fm.title ?? '',
    status: String(fm.status ?? '').toLowerCase(),
    skills: list(fm.skills),
    covers: list(fm.covers).map(normAC),
    blockedBy: list(fm['blocked-by']),
    sections,
    deliveredPaths: deliveredPaths(findSection(sections, 'Delivered')?.body ?? ''),
  }
}

/** Tasks in `dir` (`NN-slug.md`, sorted), or null when the dir does not exist or holds no tasks. */
export function loadTasks(dir) {
  if (!exists(dir)) return null
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
  return files.length ? files.map((f) => parseTask(readText(path.join(dir, f)), f)) : null
}

/** Skill names a task may reference: the curated catalog plus project skills under .afv/skills/. */
export function knownSkills(root) {
  const skillsDir = path.join(root, '.afv', 'skills')
  const catalogFile = path.join(skillsDir, 'sf-spec-tasks', 'skill-catalog.md')
  const catalog = new Set()
  for (const line of (readText(catalogFile) ?? '').split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/)
    if (m) catalog.add(m[1].trim())
  }
  const project = new Set()
  if (exists(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      project.add(d.name)
      const name = parseFrontMatter(readText(path.join(skillsDir, d.name, 'SKILL.md')) ?? '').fm.name
      if (name) project.add(name)
    }
  }
  return { catalog, project, catalogFile, catalogFound: exists(catalogFile) }
}

/** Every file under `dir`, as posix paths relative to it (skips .DS_Store). */
export function listFiles(dir) {
  if (!exists(dir)) return []
  const out = []
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(d, e.name), r)
      else if (e.isFile() && e.name !== '.DS_Store') out.push(r)
    }
  }
  walk(dir, '')
  return out.sort()
}

const block = (name, md) => `<!-- sf-spec:${name}:start -->\n${md.trim()}\n<!-- sf-spec:${name}:end -->`
const PLACEHOLDERS = {
  readiness: '_Readiness not checked yet — run /sf-spec-score._',
  evidence: '_Delivery evidence not collected yet — run /sf-spec-score._',
  review: '_Spec review not written yet — run /sf-spec-score._',
}

/** Replace one named block in architecture/scorecards/<feature>.md, leaving everything else untouched. */
export function upsertScorecardBlock(root, feature, name, markdown) {
  const file = path.join(root, 'architecture', 'scorecards', `${feature}.md`)
  let text = readText(file) ?? `# Scorecard: ${feature}\n\n${SCORECARD_BLOCKS.map((n) => block(n, PLACEHOLDERS[n])).join('\n\n')}\n`
  const re = new RegExp(`<!-- sf-spec:${name}:start -->[\\s\\S]*?<!-- sf-spec:${name}:end -->`)
  text = re.test(text) ? text.replace(re, () => block(name, markdown)) : `${text.trimEnd()}\n\n${block(name, markdown)}\n`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return file
}
