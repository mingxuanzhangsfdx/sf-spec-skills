---
name: sf-spec-build
description: "Use only when the user invokes /sf-spec-build. Builds an SF-Spec feature's tasks one at a time in this chat: loads each task's Salesforce skill, implements, tests, deploys to the spec's target org, and marks the task done."
---

# SF-Spec: build

Work through `architecture/specs/<feature>/tasks/` in this chat, one task at a time,
until every task is `done` or something needs the user. The spec is the
contract. When reality disagrees with it, change the spec in the open, never
silently.

Formats: `.afv/skills/sf-spec/conventions.md`.

## Before the first task

1. Run `node .afv/skills/sf-spec/scripts/readiness.mjs <feature>`. If it fails,
   stop and point to `/sf-spec-tasks` or `/sf-spec-specify`.
2. Run `node .afv/skills/sf-spec/scripts/org-guard.mjs <target-org>` on the spec's
   `target-org`.
   - Exit 3 (production): stop. Never deploy to production from this loop.
   - Exit 2: ask the user to authorize the org (`sf org login web --alias <alias>`) and stop.
3. If the user named a task id (e.g. `/sf-spec-build asset-tracker T02`), build only
   that task. Otherwise build all of them, in order.

## For each task

Pick the lowest-numbered task whose status is `todo` and whose `blocked-by`
tasks are all `done`. Set it to `in-progress`, then:

1. **Load its skills.** Load every name in `skills:` with your skill tool
   (`load_skill` in Agentforce Vibes) and follow them. They carry the
   Salesforce-specific rules, so don't improvise around them.
2. **Build the slice.** Create the files listed in `## What to build`, and nothing else.
   - Apex: `with sharing`, CRUD/FLS enforced (`WITH USER_MODE` or
     `Security.stripInaccessible`), no SOQL/DML in loops.
   - LWC: base components and SLDS, labels not hard-coded strings where the DoD
     asks for localization.
3. **Write the tests named in `## How it proves its ACs`.** Every test carries
   its AC id in the name:
   - Apex: `ac2ReturnClearsAssignee`
   - Jest: `it('AC-4: …')`
   - Sa11y: a test file containing `await expect(element).toBeAccessible()`
   A test that doesn't assert the AC's "then" is not evidence. Assert the outcome,
   not just "no exception".
4. **Validate before deploying.**
   - `sf code-analyzer run --workspace . --target <changed files> --rule-selector Recommended --output-file .sf-spec-tmp/ca.json`.
     Fix every sev 1–2 violation.
   - If LWC tests exist, run `npm run test:unit -- <test path>`.
5. **Deploy and test in the org.**
   - `sf project deploy start --source-dir <paths from this task> --target-org <alias> --wait 30 --json`
   - then `sf apex run test --class-names <this task's test classes> --code-coverage --result-format json --wait 30 --target-org <alias>`
   - If the task adds a permission set, assign it to the running user
     (`sf org assign permset --name <PermSet> --target-org <alias>`), so tests and
     manual checks run with the persona's real access.
6. **Fix loop.** On a failure, read the error, fix the cause, and redo steps 4–5.
   After 3 failed attempts on the same error, stop the loop, set the task to
   `blocked`, and tell the user exactly what fails and what you'd try next.
7. **Close the task.**
   - Fill `## Delivered`: every `force-app/…` path created or changed (one per
     line), the deploy id, and the passing test names.
   - Set `status: done`.
   - Reply with a 2–4 line progress note: task, ACs now proven, and what's next.
     Then go straight on to the next task.

## When the spec is wrong

If building shows that an AC can't be met as written (a platform limit, a
missing permission, a conflicting AC), stop that task. Then:

- Propose the smallest spec change as a numbered question with your
  recommendation.
- Once the user agrees, append an ADR, update the spec, and rerun `readiness.mjs`.

Don't build anything the spec doesn't ask for. If it seems needed, propose it as a
spec change the same way.

## After the last task

Set the spec's `status: building` → `delivered` only after `/sf-spec-score`
says SHIP. End with `Next: /sf-spec-score <feature>`.
