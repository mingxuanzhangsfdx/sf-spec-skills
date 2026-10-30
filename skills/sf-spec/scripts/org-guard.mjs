#!/usr/bin/env node
// Refuse production orgs before anything deploys to or runs tests in an org.
// Usage: node org-guard.mjs <alias>
// Prints {alias, username, instanceUrl, orgType, isSandbox, isScratch, production} as JSON.
// Exit: 0 safe · 3 production · 2 error (unknown alias, expired auth, sf missing).
import { isMain, parseJsonLoose, run, tail } from './lib.mjs'

const QUERY = 'SELECT Id, Name, OrganizationType, IsSandbox, TrialExpirationDate FROM Organization'

function sfJson(argv, cwd) {
  const r = run('sf', argv, { cwd })
  if (r.missing) return { error: 'sf CLI not found' }
  const j = parseJsonLoose(r.stdout)
  if (!j || j.status !== 0 || !j.result) return { error: `sf ${argv.slice(0, 2).join(' ')} failed: ${j?.message ?? tail(r.stderr || r.stdout, 200)}` }
  return { result: j.result }
}

export function guardOrg(alias, { cwd } = {}) {
  const commands = [
    ['sf', 'org', 'display', '--target-org', alias, '--json'],
    ['sf', 'data', 'query', '--query', QUERY, '--target-org', alias, '--json'],
  ]
  const display = sfJson(commands[0].slice(1), cwd)
  if (display.error) return { alias, error: display.error, production: null, commands }
  const query = sfJson(commands[1].slice(1), cwd)
  const org = query.result?.records?.[0]
  if (!org) return { alias, error: query.error ?? 'Organization query returned no rows', production: null, commands }
  const d = display.result
  const scratchHint = d.isScratchOrg === true || d.isScratch === true || Boolean(d.devHubId) || Boolean(d.expirationDate) || /\.scratch\./i.test(d.instanceUrl ?? '')
  const isSandbox = org.IsSandbox === true
  const isScratch = org.TrialExpirationDate != null && scratchHint
  const orgType = org.OrganizationType ?? null
  return {
    alias,
    username: d.username ?? null,
    instanceUrl: d.instanceUrl ?? null,
    orgType,
    isSandbox,
    isScratch,
    production: !isSandbox && !isScratch && orgType !== 'Developer Edition',
    commands,
  }
}

function main(argv) {
  if (argv.length !== 1 || argv[0].startsWith('-')) {
    console.error('usage: node org-guard.mjs <alias>')
    return 2
  }
  const { commands, ...g } = guardOrg(argv[0])
  console.log(JSON.stringify(g, null, 2))
  if (g.error) return 2
  return g.production ? 3 : 0
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2))
