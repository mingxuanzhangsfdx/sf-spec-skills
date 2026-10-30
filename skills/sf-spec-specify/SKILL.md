---
name: sf-spec-specify
description: "Use only when the user invokes /sf-spec-specify. Turns architecture/intent.md and its ADRs into a testable feature spec at architecture/specs/<feature>.md and keeps fixing it until the readiness check passes."
---

# SF-Spec: specify

Write the spec the build and the scorecard are held to. Every acceptance
criterion must be provable, and the readiness script decides when it's done.

Formats: `.afv/skills/sf-spec/conventions.md`. Read it first. The spec must
match it exactly or the scripts can't parse it.

## Inputs

`architecture/intent.md` and `architecture/architectural-decisions.md`. If
either is missing, say so and offer `/sf-spec-grill`, or run one grill round
inline if the user's message already holds most of the answers. Take the
feature slug from the user's message. If they didn't give one and only one
feature exists, use it. Otherwise ask.

## Write `architecture/specs/<feature>.md`

Front matter: `feature`, `status: draft`, `target-org` (from the grill), and
optionally `coverage-target` (default 75).

Write the required sections in order. Notes on each:

- **Problem Statement / Solution**: a few sentences each, from intent.md.
- **User Stories**: `- US-n: As a …, I want …, so that ….` Cover every persona in intent.
- **Acceptance Criteria**: `- AC-n (US-n): Given …, when …, then …. [verify: tag]`
  - One observable behavior per AC. Include the negative and permission cases
    (e.g., "an Employee cannot see another employee's laptop"). Those are where
    Salesforce apps break.
  - Pick the strongest verify tag that can prove it, in this order: `apex` >
    `jest` > `a11y` > `deploy` > `manual`. Use `manual` only when no automated
    test can observe the behavior, and say why in the AC.
  - Every LWC with a template gets an `a11y` AC.
- **Data Model**: objects (reused or new) and their fields, types and
  relationships, citing the ADR that chose them.
- **Security Model**: OWD per object, sharing rules, and one permission set per
  persona with its object/field access. Apex runs `with sharing` and enforces
  CRUD/FLS (`WITH USER_MODE` or `Security.stripInaccessible`).
- **Observability**: what's logged or traced on failure and where an admin sees it.
- **Definition of Done**: take the SF-Spec web-app DoD (service abstraction, auth,
  design system, localization, globalization, accessibility tests, brand, Code
  Analyzer, `npm audit --audit-level=high`, LCP, HTTP error codes, SEO, sitemap,
  Jest, coded UI tests, scale tests, agent readiness). Keep only what applies.
  - Map each kept item to the scorecard gate that proves it: `code-analyzer`,
    `apex-tests`, `lwc-jest`, `a11y`, `npm-audit`, `deployable`, or `manual`.
  - List dropped items as `N/A — <reason>` (e.g., SEO and sitemap for an
    internal Lightning app). Never claim a gate the scorecard doesn't run.
- **Out of Scope**: what was deliberately left out, from intent's Non-goals.

Also write or refresh `architecture/overview.md`: a mermaid ER diagram of the data
model and a short component map (objects → Apex → LWC/pages → permission sets).

## Check readiness, then fix

Run `node .afv/skills/sf-spec/scripts/readiness.mjs <feature> --spec-only`.

- Fix every FAIL yourself. Only if a fix needs a decision the user hasn't made,
  ask it grill-style (numbered, with a recommended answer).
- Re-run until it exits 0, then set `status: ready` in the front matter.

Show the AC list and the readiness result, then end with
`Next: /sf-spec-tasks <feature>`.
