---
name: sf-spec-tasks
description: "Use only when the user invokes /sf-spec-tasks. Splits a ready SF-Spec feature spec into vertical-slice task files, each tagged with the Salesforce skill to build it, the ACs it covers, and what blocks it."
---

# SF-Spec: tasks

Break `architecture/specs/<feature>.md` into tracer-bullet tasks. Each task is a
thin slice through data, logic, UI and tests that can be deployed and shown on
its own, not a horizontal layer like "all objects" or "all Apex".

Formats: `.afv/skills/sf-spec/conventions.md`. Skill names:
`.afv/skills/sf-spec-tasks/skill-catalog.md`.

## Steps

1. Run `node .afv/skills/sf-spec/scripts/readiness.mjs <feature> --spec-only`.
   If it fails, stop and point to `/sf-spec-specify`.
2. Draft the slices:
   - **T01 is the thinnest end-to-end path.** It holds the object, fields and
     permission set it needs, plus one behavior proven by a test (e.g., create a
     laptop as Available). Every later task builds on a working, deployed base.
   - Each later slice adds one user-visible capability and the ACs that prove it.
     Security ACs ride with the slice whose behavior they guard, and so do the
     a11y ACs for its components.
   - Aim for 3–7 tasks. Merge any slice that proves no AC into a neighbor.
   - `blocked-by` lists only real dependencies. Unblocked tasks with no
     dependency on each other form a wave and can be built in any order.
3. Write `architecture/specs/<feature>/tasks/NN-slug.md` per conventions:
   - `skills`: catalog names, the primary one first. Add
     `platform-metadata-api-context-get` to any task that generates metadata.
   - `covers`: the AC ids the slice proves.
   - `## What to build`: the concrete files under `force-app/`.
   - `## How it proves its ACs`: the test names, carrying AC ids
     (`ac3EmployeeSeesOnlyOwnLaptops`, `'AC-5: laptop list is accessible'`).
   - Leave `## Delivered` empty. `/sf-spec-build` fills it.
4. Run `node .afv/skills/sf-spec/scripts/readiness.mjs <feature>` (no `--spec-only`).
   It checks that every AC is covered, the references resolve, there are no
   cycles, and every skill name is known. Fix the tasks until it exits 0.
5. Show a mermaid graph of the tasks (edges = `blocked-by`, labels = covered ACs)
   and the waves, then end with `Next: /sf-spec-build <feature>`.

Don't ask the user to approve each task. Show the plan and let them edit the
files or say what to change.
