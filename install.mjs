#!/usr/bin/env node
// Install the SF-Spec skills into a Salesforce DX project for Agentforce Vibes.
// Usage: node install.mjs <path-to-sfdx-project> [--no-npm] [--force]
//   - copies skills/ into <project>/.afv/skills/ (AFV's project skill tier)
//   - adds @sa11y/jest and registers its toBeAccessible() matcher in jest.config.js
//   - ignores .sf-spec-tmp/ (scratch tool output) in .gitignore
// Exit: 0 installed · 1 failed · 2 usage error.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SKILLS = path.join(here, 'skills')
const SA11Y_SETUP = 'jest-sa11y-setup.js'
const SA11Y_SETUP_SRC = `// Registers Sa11y's toBeAccessible() matcher for LWC Jest tests.
const { registerSa11yMatcher } = require('@sa11y/jest');

registerSa11yMatcher();
`
const JEST_CONFIG_SRC = `const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    setupFilesAfterEnv: [...(jestConfig.setupFilesAfterEnv || []), '<rootDir>/${SA11Y_SETUP}'],
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver']
};
`
// jest.config.js as `sf project generate --template standard` writes it; anything else is the user's.
const STOCK_JEST_CONFIG = `const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');
module.exports = { ...jestConfig, modulePathIgnorePatterns: ['<rootDir>/.localdevserver'] };`
const squash = (s) => s.replace(/\s+/g, '')

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const [target] = args.filter((a) => !a.startsWith('--'))
const unknown = [...flags].filter((f) => !['--no-npm', '--force'].includes(f))
if (!target || unknown.length) {
  console.error(`usage: node install.mjs <path-to-sfdx-project> [--no-npm] [--force]${unknown.length ? `\nunknown option ${unknown.join(', ')}` : ''}`)
  process.exit(2)
}

const root = path.resolve(target)
const rel = (p) => path.relative(root, p) || '.'
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }
if (!fs.existsSync(path.join(root, 'sfdx-project.json'))) fail(`${root} has no sfdx-project.json — run this on a Salesforce DX project (sf template generate project)`)

// 1. Skills → .afv/skills/
const dest = path.join(root, '.afv', 'skills')
const names = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
const clashes = names.filter((n) => fs.existsSync(path.join(dest, n)))
if (clashes.length && !flags.has('--force')) fail(`${rel(dest)} already has ${clashes.join(', ')} — rerun with --force to overwrite`)
for (const n of names) {
  fs.rmSync(path.join(dest, n), { recursive: true, force: true })
  // The scripts' own test suite stays in this repo; projects only need the skills and scripts.
  const tests = path.join(SKILLS, 'sf-spec', 'scripts', 'test')
  fs.cpSync(path.join(SKILLS, n), path.join(dest, n), { recursive: true, filter: (src) => src !== tests && path.basename(src) !== '.DS_Store' })
}
console.log(`✓ ${names.length} skills → ${rel(dest)}/ (${names.join(', ')})`)

// 2. Sa11y matcher for the a11y gate
fs.writeFileSync(path.join(root, SA11Y_SETUP), SA11Y_SETUP_SRC)
const jestConfig = path.join(root, 'jest.config.js')
const current = fs.existsSync(jestConfig) ? fs.readFileSync(jestConfig, 'utf8') : null
if (current?.includes(SA11Y_SETUP)) console.log(`✓ ${rel(jestConfig)} already registers ${SA11Y_SETUP}`)
else if (current === null || squash(current) === squash(STOCK_JEST_CONFIG)) {
  fs.writeFileSync(jestConfig, JEST_CONFIG_SRC)
  console.log(`✓ ${rel(jestConfig)} registers ${SA11Y_SETUP}`)
} else console.log(`! ${rel(jestConfig)} is customized — add '<rootDir>/${SA11Y_SETUP}' to setupFilesAfterEnv yourself`)

// 3. Keep scratch output out of git
const gitignore = path.join(root, '.gitignore')
const ignored = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : ''
if (!ignored.split(/\r?\n/).includes('.sf-spec-tmp/')) {
  fs.appendFileSync(gitignore, `${ignored && !ignored.endsWith('\n') ? '\n' : ''}\n# SF-Spec scratch tool output\n.sf-spec-tmp/\n`)
  console.log(`✓ ${rel(gitignore)} ignores .sf-spec-tmp/`)
}

// 4. npm dev dependencies (sfdx-lwc-jest comes with the standard template)
if (flags.has('--no-npm')) console.log('• skipped npm — run: npm install && npm install --save-dev @sa11y/jest')
else {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  for (const argv of [['install'], ['install', '--save-dev', '@sa11y/jest']]) {
    console.log(`• npm ${argv.join(' ')}`)
    const r = spawnSync(npm, argv, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
    if (r.status !== 0) fail(`npm ${argv.join(' ')} failed`)
  }
}

console.log(`
Done. Open ${root} as the VS Code workspace folder, then in Agentforce Vibes chat:
  /sf-spec`)
