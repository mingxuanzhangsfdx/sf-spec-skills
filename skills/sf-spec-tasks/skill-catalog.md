# Skill catalog for task tagging

Every task's `skills:` field names skills from this table (or a project skill under
`.afv/skills/`). All of them ship in `@salesforce/afv-skills` (checked against
1.67.0). `readiness.mjs` rejects any other name, so a task can't point at a
made-up skill. Edit this file to add your own: "batteries included but changeable".

## Data model and security

| skill | use for |
|---|---|
| `platform-custom-object-generate` | custom objects, name fields, sharing model on the object |
| `platform-custom-field-generate` | fields, picklists, lookups, master-detail, roll-ups |
| `platform-value-set-generate` | global value sets shared across picklists |
| `platform-validation-rule-generate` | data-quality rules on save |
| `platform-permission-set-generate` | object/field/app/tab access for a persona |
| `platform-sharing-owd-configure` | org-wide defaults |
| `platform-sharing-rules-generate` | criteria/owner-based sharing rules |
| `dx-org-permission-set-assign` | assign a permission set to users in the target org |
| `platform-metadata-api-context-get` | schema/API context; load alongside any metadata generator |

## Logic and data

| skill | use for |
|---|---|
| `platform-apex-generate` | Apex classes, services, selectors, triggers, invocables |
| `platform-apex-test-generate` | Apex test classes (bulk, negative, permission cases) |
| `platform-apex-test-run` | run Apex tests, read coverage, test-fix loop |
| `platform-soql-query` | SOQL authoring, selectivity |
| `automation-flow-generate` | record-triggered, scheduled, screen flows |
| `platform-data-manage` | sample or test data in the org |

## UI

| skill | use for |
|---|---|
| `experience-lwc-generate` | Lightning Web Components |
| `experience-lwc-base-components-integrate` | pick and wire `lightning-*` base components |
| `experience-lds-graphql-generate` | LDS GraphQL wire adapters in LWC |
| `experience-lwc-accessibility-jest-run` | Sa11y accessibility Jest tests |
| `experience-accessibility-validate` | WCAG review of a component |
| `design-systems-slds-validate` | SLDS linter and theming compliance |
| `experience-lwc-security-validate` | Lightning Web Security checks |
| `platform-flexipage-generate` | Lightning record, app, and home pages |
| `platform-custom-tab-generate` | object and LWC tabs |
| `platform-custom-application-generate` | Lightning app with navigation |
| `platform-list-view-generate` | list views |
| `platform-report-generate` | reports |

## React / UI bundle apps

| skill | use for |
|---|---|
| `experience-ui-bundle-app-coordinate` | entry point for a React web app on Salesforce |
| `experience-ui-bundle-project-generate` | starter UI bundle project |
| `experience-ui-bundle-frontend-generate` | pages and components in an existing bundle |
| `experience-ui-bundle-salesforce-data-access` | data access from a bundle |
| `experience-ui-bundle-deploy` | deploy a bundle and post-deploy setup |

## Quality, delivery, observability

| skill | use for |
|---|---|
| `dx-code-analyzer-run` | Code Analyzer scans and results |
| `dx-apexguru-scan` | ApexGuru performance scan |
| `platform-metadata-deploy` | deploy or validate metadata to the target org |
| `platform-metadata-retrieve` | pull existing metadata to reuse or compare |
| `platform-tracing-configure` | Platform Tracing (EventSettings) |
| `external-diagram-mermaid-generate` | data model and flow diagrams for `overview.md` |
