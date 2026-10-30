---
name: sf-spec-score
description: "Use only when the user invokes /sf-spec-score. Grades an SF-Spec feature: readiness before build, or delivery after build. Delivery scores from real tool evidence, never self-assessment, and writes architecture/scorecards/<feature>.md."
---

# SF-Spec: score

A scorecard that rests on evidence. Tool output decides the Standards axis, and
passing tests that carry AC ids decide the Spec axis. Your judgment can only
**downgrade** a result (a test that doesn't really assert its AC). It can never
turn a missing or failing check into a pass. "Not verified" never counts as a pass.

Formats and gate states: `.afv/skills/sf-spec/conventions.md`.

## Pick the mode

- `/sf-spec-score <feature> readiness`, or no `force-app/` source exists yet →
  **readiness**.
- Otherwise → **delivery**.

## Readiness

Run `node .afv/skills/sf-spec/scripts/readiness.mjs <feature> --write`. It writes
the readiness block of the scorecard. Report the failing checks and the command
that fixes each (`/sf-spec-specify` or `/sf-spec-tasks`).

## Delivery

1. **Collect evidence.** Run
   `node .afv/skills/sf-spec/scripts/collect-evidence.mjs <feature>`.
   - It runs Code Analyzer, Apex tests with coverage, LWC Jest, Sa11y,
     `npm audit --audit-level=high`, and a deploy dry-run against the spec's
     target org.
   - It maps test names to AC ids, finds untraced files, and writes the evidence
     block plus raw outputs under `architecture/scorecards/<feature>/`.
   - Don't edit the evidence block by hand, and don't rerun individual tools to
     "fix" a gate. If a gate is wrong, fix the code and rerun the script.
   - If the org isn't reachable, the org gates are NOT_RUN. Say so; don't
     estimate them.
2. **Review the Spec axis.**
   - For each AC the script marked VERIFIED, open the cited test(s) and the code
     they exercise. Grade it:
     - **Met**: the test sets up the "given", performs the "when", and asserts the "then".
     - **Weak**: the test passes but doesn't assert the outcome (only "no
       exception", a wrong field, or the happy path where the AC is a negative or
       permission case). Name the missing assertion.
   - FAILING, UNVERIFIED and NOT_RUN ACs stay as the script says. You may add
     *why* (e.g., "no test exercises the Employee persona").
   - For MANUAL ACs, give the exact steps a human runs to check them.
3. **Review scope.** For each untraced file, and anything a task delivered that no
   AC asks for, say whether it's needed plumbing (e.g., a tab or app the spec
   implies) or scope creep. Recommend either a spec change or removal.
4. **Write the review block.** Edit
   `architecture/scorecards/<feature>.md`, replacing everything between
   `<!-- sf-spec:review:start -->` and `<!-- sf-spec:review:end -->` with:
   - `## Spec review`: a table of AC · script state · your grade (Met/Weak/—) · evidence (test names) · gap.
   - `## Scope`: untraced files and verdicts.
   - `## Fix list`: the shortest ordered list of changes that would turn every
     gate and AC green, each naming the task to reopen.
   - `## Verdict`: the script's verdict, downgraded to NOT READY if any AC is
     Weak. Never upgraded.
5. **Reply** with the script's headline line, the verdict, and the top 3 fixes.
   - If the verdict is SHIP, set the spec's `status: delivered`.
   - If it isn't, offer to reopen the tasks in the fix list (set them to `todo`)
     and continue with `/sf-spec-build`.

## Comparing two builds

To compare SF-Spec against a plain-chat build of the same feature, score the
other checkout against this project's spec:
`node .afv/skills/sf-spec/scripts/collect-evidence.mjs <feature> --root <other-checkout> --spec architecture/specs/<feature>.md --no-tasks`.
`--no-tasks` keeps this project's tasks from being traced against the other code, so traceability is skipped. The Standards and
Spec axes still compare directly. Put the two headlines side by side.
