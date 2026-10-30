# Scorecard: asset-tracker

<!-- sf-spec:readiness:start -->
_Readiness not checked yet — run /sf-spec-score._
<!-- sf-spec:readiness:end -->

<!-- sf-spec:evidence:start -->
### Delivery evidence — asset-tracker

**Standards: 6/6 gates passing (N/A excluded) · Spec: 10/12 ACs verified by tests, 0 deploy-verified, 2 manual · Untraced files: 32 · Verdict: SHIP**

_Collected 2026-10-30T21:09:42.692Z · spec `architecture/specs/asset-tracker.md` · org blitzafv2 (Enterprise Edition, sandbox) · raw evidence in `architecture/scorecards/asset-tracker/`_

#### Standards gates

| Gate | State | Result |
|---|---|---|
| code-analyzer | PASS | sev1 0 · sev2 0 · sev3 0 · sev4 0 · sev5 0 (gate: sev1+sev2 = 0) |
| apex-tests | PASS | 8 passed · 0 failed · coverage 100% of production classes (target 75%) |
| lwc-jest | PASS | 3/3 passed · 0 failed · 0 suite(s) failed |
| a11y | PASS | 1/1 templated components have a passing Sa11y test |
| npm-audit | PASS | critical 0 · high 0 · moderate 0 · low 16 (gate: high+critical = 0) |
| deployable | PASS | dry-run deploy succeeded (0AfWI00000LNnOv0AL) |

- **apex-tests**
  - per class: AssetTrackerController 100%

<details><summary>Commands run</summary>

- code-analyzer: `sf code-analyzer run --workspace . --target force-app --rule-selector Recommended --output-file architecture/scorecards/asset-tracker/code-analyzer.json`
- apex-tests: `sf apex run test --class-names AssetTrackerControllerTest --code-coverage --result-format json --json --wait 30 --target-org blitzafv2`
- lwc-jest: `node_modules/.bin/sfdx-lwc-jest -- --json --outputFile=architecture/scorecards/asset-tracker/jest.json`
- npm-audit: `npm audit --audit-level=high --json`
- deployable: `sf project deploy start --dry-run --source-dir force-app --target-org blitzafv2 --test-level NoTestRun --wait 30 --json`

</details>

#### Acceptance criteria

| AC | Verify | State | Evidence |
|---|---|---|---|
| AC-1 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac1CreateAvailableLaptop |
| AC-2 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac2AssignAvailableLaptop |
| AC-3 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac3ReturnAssignedLaptop |
| AC-4 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac4BlockAssignRetiredAsset |
| AC-5 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac5ITAdminSeesAllAssets |
| AC-6 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac6EmployeeSeesOwnLaptop |
| AC-7 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac7EmployeeCannotSeeOtherLaptop |
| AC-8 | apex | VERIFIED | passing test cites it · ✓ AssetTrackerControllerTest.ac8NonAdminCannotSeeOtherOwnersAssets |
| AC-9 | a11y | VERIFIED | passing Sa11y test cites it · ✓ c-my-laptops AC-9: myLaptops component is accessible |
| AC-10 | jest | VERIFIED | passing test cites it · ✓ c-my-laptops AC-10: displays Name, SerialNumber, and Status columns with laptop data · ✓ c-my-laptops AC-10: shows empty-state message when no laptops are assigned |
| AC-11 | manual | MANUAL | needs a human check |
| AC-12 | manual | MANUAL | needs a human check |

#### Traceability

- Untraced files (no task's `## Delivered` claims them — possible scope creep): 
  - `force-app/main/default/objects/Asset/fields/AccountId.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Address.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/AssetLevel.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/AssetProvidedById.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/AssetServicedById.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ConsequenceOfFailure.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ContactId.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Description.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/DigitalAssetStatus.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ExternalIdentifier.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/InstallDate.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/IsCompetitorProduct.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/IsInternal.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/LocationId.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ManufactureDate.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Name.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/OwnerId.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ParentId.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Price.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Product2Id.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ProductCode.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ProductDescription.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/ProductFamily.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/PurchaseDate.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Quantity.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/RootAssetId.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/SerialNumber.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/StatusReason.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/StockKeepingUnit.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/UsageEndDate.field-meta.xml`
  - `force-app/main/default/objects/Asset/fields/Uuid.field-meta.xml`
  - `force-app/main/default/objects/Asset/listViews/AllAssets.listView-meta.xml`
- Tasks not done: none
- ACs no task covers: none

#### Verdict: SHIP

- every applicable gate passes and every AC is verified

Needs human check: AC-11, AC-12
<!-- sf-spec:evidence:end -->

<!-- sf-spec:review:start -->
## Spec review

| AC | Script state | Grade | Evidence | Gap |
|---|---|---|---|---|
| AC-1: IT Admin inserts Available asset | VERIFIED | Met | `ac1CreateAvailableLaptop` — inserts with Status=Available, asserts Status field equals Available via WITH USER_MODE query | — |
| AC-2: IT Admin assigns to employee | VERIFIED | Met | `ac2AssignAvailableLaptop` — updates Status=Assigned + AssignedUser__c, asserts both fields | — |
| AC-3: IT Admin returns laptop | VERIFIED | Met | `ac3ReturnAssignedLaptop` — clears AssignedUser__c + Status=Available, asserts both null/Available | — |
| AC-4: Retired asset cannot be assigned | VERIFIED | Met | `ac4BlockAssignRetiredAsset` — catches DmlException on Retired→Assigned transition, asserts message contains "retired" | — |
| AC-5: IT Admin sees all assets | VERIFIED | Met | `ac5ITAdminSeesAllAssets` — two assets owned by different IT Admin users, WITH USER_MODE query returns count=2 | — |
| AC-6: Employee sees their own laptop via controller | VERIFIED | Met | `ac6EmployeeSeesOwnLaptop` — runAs employee, calls getMyLaptops(), asserts size=1 and correct SerialNumber | — |
| AC-7: Employee cannot see another employee's laptop | VERIFIED | Met | `ac7EmployeeCannotSeeOtherLaptop` — runAs Employee A, calls getMyLaptops(), asserts size=0 when only Employee B's laptop exists | — |
| AC-8: Non-admin cannot see other-owner assets | VERIFIED | Met | `ac8NonAdminCannotSeeOtherOwnersAssets` — non-admin viewer queries WITH USER_MODE while owner's asset exists, asserts count=0 (Private OWD enforcement) | — |
| AC-9: myLaptops component is accessible | VERIFIED (a11y) | Met | `AC-9: myLaptops component is accessible` — Sa11y toBeAccessible() with mock data | — |
| AC-10: datatable shows Name, SerialNumber, Status | VERIFIED (jest) | Met | `AC-10: displays Name, SerialNumber, and Status columns…` asserts fieldNames and data length; `AC-10: shows empty-state message…` asserts no table + empty-state paragraph | — |
| AC-11: Employee receives assignment email | MANUAL | — | — | IT Admin must assign a laptop to an employee in blitzafv2 and confirm the employee's inbox receives subject "Laptop Assigned: \<name\>" containing SerialNumber. |
| AC-12: Employee receives return email | MANUAL | — | — | IT Admin must clear AssignedUser__c (return) and confirm prior employee receives subject "Laptop Return Confirmed: \<name\>" containing SerialNumber. |

## Scope

Untraced files are all standard Asset object field-metadata files auto-retrieved alongside the custom AssignedUser__c field and the Asset object sharingModel change (`sf project retrieve start`). They belong to Salesforce's standard Asset definition and were not authored by the tasks — no spec change or removal needed. The `AllAssets` list view was similarly retrieved. None is scope creep.

The `AssetTracker_ITAdmin.permissionset-meta.xml` is claimed by T01 and updated by T02 — correctly traced to both tasks.

## Fix list

No fixes required. All gates green. AC-11 and AC-12 need manual org verification by an IT Admin user.

## Verdict

**SHIP** — 6/6 gates passing, 10/10 automated ACs Met, 2 MANUAL ACs pending human verification in blitzafv2.
<!-- sf-spec:review:end -->
