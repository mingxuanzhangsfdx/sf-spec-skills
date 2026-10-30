---
name: sf-spec
description: "Use only when the user invokes /sf-spec or asks where an SF-Spec feature stands. Reads architecture/ and reports each feature's spec phase and the one /sf-spec-* command to run next."
---

# SF-Spec

Spec-driven development for Salesforce in five small skills. Each does one job,
writes plain markdown under `architecture/`, and hands off to the next. Any
step can be skipped or rerun.

```
/sf-spec-grill    → architecture/intent.md, architecture/architectural-decisions.md
/sf-spec-specify  → architecture/specs/<feature>.md, architecture/overview.md
/sf-spec-tasks    → architecture/specs/<feature>/tasks/NN-slug.md
/sf-spec-build    → force-app/… deployed to the target org, tasks marked done
/sf-spec-score    → architecture/scorecards/<feature>.md
```

File formats live in `.afv/skills/sf-spec/conventions.md`. Read it before
writing or judging any SF-Spec file.

## What to do

1. If the user's message after `/sf-spec` describes something to build, skip the
   status report and start `/sf-spec-grill`: load the `sf-spec-grill` skill and
   follow it with their request.
2. Otherwise work out the state of each feature. Read files only and change
   nothing.
   - No `architecture/intent.md` → next is `/sf-spec-grill`.
   - Intent exists but there's no `architecture/specs/*.md` → `/sf-spec-specify`.
   - For each `architecture/specs/<feature>.md`, run
     `node .afv/skills/sf-spec/scripts/readiness.mjs <feature>`.
     - Spec checks fail → `/sf-spec-specify` (to fix the spec).
     - No tasks dir, or task checks fail → `/sf-spec-tasks`.
     - Any task not `done` → `/sf-spec-build`.
     - All tasks done and no `architecture/scorecards/<feature>.md` evidence
       block, or force-app changed since the scorecard was written →
       `/sf-spec-score`.
     - Otherwise the feature is delivered. Show the scorecard headline.
3. Reply with one short table (feature · status · tasks done/total · next command)
   and stop. Don't start the next phase unless the user asks.
