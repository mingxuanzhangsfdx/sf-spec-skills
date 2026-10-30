# SF-Spec conventions

The contract every `/sf-spec-*` skill reads and writes, and the two scripts
(`readiness.mjs`, `collect-evidence.mjs`) parse. Plain markdown, portable to any
agent. If you change a format here, change the scripts with it.

## Layout

```
architecture/
  intent.md                      # why, for whom, measurable outcomes   (sf-spec-grill)
  architectural-decisions.md     # ADR log                               (sf-spec-grill, appended later)
  overview.md                    # data model + component map            (sf-spec-specify)
  specs/<feature>.md             # the feature spec                      (sf-spec-specify)
  specs/<feature>/tasks/NN-slug.md   # vertical-slice tasks              (sf-spec-tasks, sf-spec-build)
  scorecards/<feature>.md        # readiness + delivery scorecard        (sf-spec-score)
  scorecards/<feature>/          # raw tool evidence + gates.json        (collect-evidence.mjs)
```

`<feature>` is a kebab-case slug, e.g. `asset-tracker`.

## intent.md

Sections (all `##`): `Problem`, `Users`, `Outcomes`, `Constraints`, `Non-goals`,
`Open questions`. Ready only when `Open questions` is empty or says `None`.

## architectural-decisions.md

One `## ADR-NNN: <title>` per decision, each with bullet fields
`Status:` (Proposed | Accepted | Superseded by ADR-NNN), `Context:`, `Decision:`,
`Consequences:`, and `Reuse checked:` (what existing org/project metadata was
looked at before deciding to build something new).

## specs/<feature>.md

Front matter:

```
---
feature: asset-tracker
status: draft            # draft | ready | building | delivered
target-org: myDevOrg     # sf CLI alias; never a production org
---
```

Required `##` sections, in this order: `Problem Statement`, `Solution`,
`User Stories`, `Acceptance Criteria`, `Data Model`, `Security Model`,
`Observability`, `Definition of Done`, `Out of Scope`. Optional: `Further Notes`.

User stories are bullets: `- US-1: As a <role>, I want <capability>, so that <benefit>.`

Acceptance criteria are bullets with an id, the story they serve, a
Given/When/Then, and a verify tag naming how it will be proven:

```
- AC-1 (US-1): Given an available laptop, when an IT admin assigns it to an employee, then its status becomes Assigned and the employee is recorded. [verify: apex]
```

Verify tags:

| tag      | proven by                                                                  |
|----------|----------------------------------------------------------------------------|
| `apex`   | a passing Apex test method whose name carries the AC id (`ac1…`)           |
| `jest`   | a passing LWC Jest test whose name carries the AC id (`'AC-1: …'`)         |
| `a11y`   | a passing Sa11y (`toBeAccessible`) Jest test whose name carries the AC id  |
| `deploy` | the metadata deploys cleanly and the scorecard cites the file that does it |
| `manual` | a human checks it; never counted as verified by the tooling                |

The spec must not contain `TBD`, `TODO`, `???`, or `[NEEDS CLARIFICATION`.

## Test naming (how ACs are traced to evidence)

A test proves an AC when its name contains the AC id, matched case-insensitively
with the pattern `(?<![A-Za-z])ac[-_]?(\d+)(?![0-9])` (no letter right before `ac`, so `ac1Ac2…` yields both ids and `MacBook` none). So:

- Apex: `@IsTest static void ac1AssignAvailableLaptop()`, or `ac1Ac2…` for two. camelCase keeps PMD MethodNamingConventions quiet.
- Jest: `it('AC-3: lists only my assigned laptops', …)`.

## Tasks: specs/<feature>/tasks/NN-slug.md

```
---
id: T01
title: Laptop record and assignment
skills: platform-custom-object-generate, platform-apex-generate, platform-apex-test-generate
covers: AC-1, AC-2
blocked-by: none        # or: T01, T02
status: todo            # todo | in-progress | done | blocked
---
## What to build
## How it proves its ACs
## Delivered
```

- `skills` is a comma list; the first is the primary skill. Every name must be in
  `.afv/skills/sf-spec-tasks/skill-catalog.md` or be a project skill under `.afv/skills/`.
- `covers` and `blocked-by` are comma lists (`none` for empty).
- `## Delivered` is written by `sf-spec-build` and must list every source path the
  task created or changed (files or directories, each starting `force-app/`), plus
  the deploy id and the tests that passed. The scorecard flags any `force-app/` file
  no task claims as untraced (possible scope creep).

## Scorecard gate states

`PASS` · `FAIL` · `NOT_RUN` (applicable but not executed: no org, tool missing) ·
`N/A` (nothing to check, e.g. no Apex). Only `PASS` and `N/A` count as passing.
"Not verified" is never a pass.
