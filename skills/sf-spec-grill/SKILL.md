---
name: sf-spec-grill
description: "Use only when the user invokes /sf-spec-grill. Interviews the user in short rounds of recommended answers to settle what to build on Salesforce, then writes architecture/intent.md and architectural-decisions.md."
---

# SF-Spec: grill

Get to a shared understanding of what to build before anyone writes a spec.
Look up the facts yourself and put only the decisions to the user, each with
your recommendation. The user's request is the text around this skill in their
message.

Formats: `.afv/skills/sf-spec/conventions.md`.

## 1. Gather facts first (don't ask what you can look up)

- Read `sfdx-project.json`, list `force-app/`, and read any existing `architecture/`
  files. If `intent.md` already exists, you are refining it, not starting over.
- Find a target org. Use `sf org list --json`, and the default from
  `sf config get target-org --json`. Run `node .afv/skills/sf-spec/scripts/org-guard.mjs <alias>`
  on the candidate. Exit 3 means production: never propose it.
- **Reuse check.** Before proposing any new object, look for standard objects and
  existing custom metadata that already fit:
  `sf sobject list --sobject all --target-org <alias> --json`, then
  `sf sobject describe --sobject <Name> --target-org <alias> --json` for the
  likely matches. For example, standard `Asset` for tracked equipment and `User`
  or `Contact` for people. If the project has metadata, check it too. Record what
  you checked. It goes into each ADR's `Reuse checked:` line.

## 2. Grill in rounds

Each round is at most 5 numbered questions. Each question gets your
recommended answer and a one-line reason, and is worded so that "yes" accepts
it:

```
Round 1: reply "yes" to accept all, or "yes except 2: …"

1. Who uses it? Recommended: two personas, IT Admin (manages laptops) and Employee (sees their own). Smallest set that covers assign/return.
2. Reuse standard Asset or create Laptop__c? Recommended: …, because describe shows …
```

Walk the decision tree in this order. Skip branches the request already settles,
and drop branches that don't apply:

1. Users and personas, and the outcome each needs (measurable where possible)
2. Data: reuse vs. new objects, key fields, relationships, record volumes
3. Security: who sees and edits which records (OWD, sharing, permission sets per persona)
4. Surface: LWC in a Lightning app, a React UI bundle, or no UI; plus the pages
5. Automation and logic: Apex vs. Flow, validation rules, notifications
6. Observability: what to log or trace, and what an admin needs to see when it breaks
7. Non-goals, and the target org alias for build and deploy

Ask a follow-up question only when an answer opens a new branch. Stop when the
branches that matter are settled or the user says "enough". For a small
feature, 2–3 rounds is normal.

## 3. Write the files

- `architecture/intent.md`: `Problem`, `Users`, `Outcomes`, `Constraints`,
  `Non-goals`, `Open questions` (`None` once settled).
- `architecture/architectural-decisions.md`: one `## ADR-NNN` per real decision
  (data, security, surface, logic). Each has `Status:`, `Context:`, `Decision:`,
  `Consequences:`, `Reuse checked:`. Append to an existing log; never renumber it.

Keep both files short, because the spec carries the detail. Show the user a
3–5 line summary of what was decided, then end with:
`Next: /sf-spec-specify <feature-slug> (target org: <alias>)`.
