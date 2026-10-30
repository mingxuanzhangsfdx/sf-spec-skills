# SF-Spec: spec-driven development skills for Agentforce Vibes

Six small skills that take a Salesforce feature from a one-line idea to a deployed,
evidence-scored build, entirely inside Agentforce Vibes (AFV) chat.

- **Plain markdown.** The spec, the plan and the scorecard are files under
  `architecture/`, in your repo next to the code.
- **Shipped Salesforce skills do the building.** The build loads the skills AFV
  ships, such as `platform-apex-generate` and `experience-lwc-generate`.
- **A script decides the score, not the model.** It runs Code Analyzer, Apex tests
  with coverage, LWC Jest, Sa11y, `npm audit` and a deploy dry-run against your org.

```
/sf-spec-grill  →  /sf-spec-specify  →  /sf-spec-tasks  →  /sf-spec-build  →  /sf-spec-score
  questions          testable spec        vertical-slice      build, test,       SHIP or
  + decisions        with AC ids          tasks + skills      deploy per task    NOT READY
```

| command | does | writes |
|---|---|---|
| `/sf-spec` | shows where each feature stands and the one command to run next | nothing |
| `/sf-spec-grill <idea>` | checks the org for reuse, then asks rounds of up to 5 questions, each with a recommended answer | `architecture/intent.md`, `architecture/architectural-decisions.md` |
| `/sf-spec-specify <feature>` | turns the intent into user stories and numbered acceptance criteria, each tagged with how it will be verified; loops until the readiness check passes | `architecture/specs/<feature>.md`, `architecture/overview.md` |
| `/sf-spec-tasks <feature>` | splits the spec into thin end-to-end tasks, each naming the shipped AFV skill that builds it | `architecture/specs/<feature>/tasks/NN-slug.md` |
| `/sf-spec-build <feature>` | per task: load the skill → build → name tests after AC ids → Code Analyzer → deploy → run tests → mark done | `force-app/…`, each task's `## Delivered` |
| `/sf-spec-score <feature>` | runs every quality tool and traces each AC to a passing test | `architecture/scorecards/<feature>.md` |

## Requirements

- VS Code with the **Agentforce Vibes** extension, signed in. AFV ships the Salesforce
  skills (`@salesforce/afv-skills`) and keeps them updated.
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) with
  the Code Analyzer plugin: `sf plugins install code-analyzer`. Its PMD engine needs Java 11+.
- Node.js 20 or later.
- A Developer Edition, scratch or sandbox org, authenticated with
  `sf org login web --alias <alias>`. **Production orgs are refused**: the build and
  the scorecard run `org-guard.mjs` before touching an org.

## Install into a Salesforce DX project

```bash
git clone https://github.com/mingxuanzhangsfdx/sf-spec-skills.git

# a fresh project (or skip this and use your own)
sf template generate project --name laptop-tracker --template standard

node sf-spec-skills/install.mjs laptop-tracker
```

`install.mjs` makes these changes to the project:

- copies `skills/*` into `laptop-tracker/.afv/skills/`, AFV's project skill folder
- adds `@sa11y/jest` and registers its `toBeAccessible()` matcher in `jest.config.js`,
  so the accessibility gate can run
- adds `.sf-spec-tmp/` (scratch tool output) to `.gitignore`
- runs `npm install`

Options: `--no-npm` skips the npm steps, and `--force` overwrites existing sf-spec
skills (for updates).

To install by hand instead:

1. Copy `skills/*` to `<project>/.afv/skills/`.
2. Run `npm install --save-dev @sa11y/jest`.
3. Add a setup file that calls `registerSa11yMatcher()`, and list it in `setupFilesAfterEnv`.

## Run it in Agentforce Vibes

1. **Open the project folder itself** in VS Code (File → Open Folder → `laptop-tracker`).
   AFV reads project skills from the *primary* workspace folder only, so don't open a
   parent folder.
2. **Check the skills loaded.** In the AFV sidebar, go to Toolkit → Skills. Six
   `sf-spec*` skills should appear under the project scope, and typing `/sf-spec` in
   the chat box should list them.
3. **Set up the chat:**
   - **Mode:** **Act**. Plan mode is read-only and can't write files or deploy.
   - **Model:** a **Claude** model. The build depends on the model loading skills by name.
   - **Approvals:** keep the default and approve the `sf …` / `node …` commands as
     they come, or turn on auto-run.
4. **Run the steps.** One chat per step works well. Every skill reads its state from
   `architecture/`, so a fresh chat loses nothing.

   ```
   /sf-spec
   /sf-spec-grill Build an asset tracker application to track employee laptops
   /sf-spec-specify asset-tracker
   /sf-spec-tasks asset-tracker
   /sf-spec-build asset-tracker
   /sf-spec-score asset-tracker
   ```

   - **Grill:** reply `yes` to accept every recommendation, or `yes except 3: …` to
     change one. Name your target org alias when it asks.
   - **Build:** it stops for you when reality disagrees with the spec. It proposes a
     spec change and an ADR, and you reply `yes` or correct it. It also stops when a
     task fails 3 fix attempts. After a stop, rerun `/sf-spec-build <feature>` and it
     continues from the next unfinished task.
5. **Read the scorecard** in `architecture/scorecards/<feature>.md`.
   - The headline looks like this: `Standards: 6/6 gates passing · Spec: 10/12 ACs verified by tests, 2 manual · Verdict: SHIP`.
   - ACs tagged `manual` list the exact steps a person runs in the org.

## How the scorecard works

- **Standards gates** come from tool output:

  | gate | passes when |
  |---|---|
  | `code-analyzer` | no sev 1–2 findings (Recommended rules) |
  | `apex-tests` | all pass, and coverage of production classes meets the spec's `coverage-target` (default 75%) |
  | `lwc-jest` | all LWC Jest tests pass |
  | `a11y` | every LWC with a template has a passing Sa11y test |
  | `npm-audit` | no high or critical findings |
  | `deployable` | a `--dry-run` deploy to the target org succeeds |

  Each gate ends as PASS, FAIL, NOT_RUN or N/A. NOT_RUN (e.g. no org or a missing
  tool) never counts as a pass.
- **Spec axis.** Each acceptance criterion `AC-n` is VERIFIED only when a passing test
  carries its id in its name. Apex methods use `ac3Assign…` and Jest tests use
  `it('AC-3: …')`. A test that fails, or no test at all, leaves the AC unverified.
- **Traceability.** Every file under `force-app/` must be listed in some task's
  `## Delivered` section. Unclaimed files are flagged as possible scope creep.
- **Review.** The model then reads each cited test and grades it Met or Weak.
  It may only **downgrade** the verdict, never upgrade it.

### Check a build you didn't make with SF-Spec

Point the scorecard at another checkout, scored against an SF-Spec spec. This is
the "plain chat vs SF-Spec" comparison:

```bash
node .afv/skills/sf-spec/scripts/collect-evidence.mjs asset-tracker \
  --root ../plain-chat-build --spec architecture/specs/asset-tracker.md --no-tasks
```

The scripts run on their own too:

```bash
node .afv/skills/sf-spec/scripts/readiness.mjs <feature>          # exit 0 = ready to build
node .afv/skills/sf-spec/scripts/collect-evidence.mjs <feature>   # exit 0 = SHIP
node .afv/skills/sf-spec/scripts/org-guard.mjs <alias>            # exit 3 = production, refused
```

## Example run

`examples/asset-tracker/architecture/` is an unedited run in Agentforce Vibes from the
prompt *"Build an asset tracker application to track employee laptops"* (Claude 4.6
Sonnet, about 50 minutes). It contains:

- the grill decisions, including two spec changes the build proposed when the org
  disagreed with the plan (ADR-005, ADR-006)
- a 12-AC spec
- 4 tasks, each with its `## Delivered` trace
- the final scorecard: 6/6 gates, 10/12 ACs verified by tests, 2 manual, SHIP

## Customizing

- **Conventions.** `skills/sf-spec/conventions.md` is the single contract between the
  skills and the scripts. It covers file layout, spec sections, the AC line format,
  task front matter and the scorecard blocks.
- **Allowed build skills.** Tasks may only name skills listed in
  `skills/sf-spec-tasks/skill-catalog.md`, or any skill under `.afv/skills/`.
  Readiness fails on anything else. Add a row to the catalog to allow another skill.
- **Coverage target.** Set `coverage-target: 85` in a spec's front matter.

## Limitations

- Skills that need an MCP server, such as `automation-flow-generate`, fall back to
  hand-written metadata when the server isn't connected. The fallback still deploys
  and is still scored.
- The scorecard proves only what the ACs ask for. If no AC says "an Employee can
  open My Laptops", nothing checks that the Employee permission set grants the tab
  and the Apex class. Write persona-access ACs for every screen.
- Spec decisions can change org-wide settings, e.g. making a standard object's
  sharing Private. Use a dedicated org for demos.

## Developing

```bash
node --test skills/sf-spec/scripts/test/    # 29 tests; fake sf/npm shims, no org needed
```

The scripts are dependency-free Node ESM. `install.mjs` doesn't copy the test suite
into projects.
