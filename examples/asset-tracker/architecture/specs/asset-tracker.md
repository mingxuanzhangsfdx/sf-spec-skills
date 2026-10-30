---
feature: asset-tracker
status: delivered
target-org: blitzafv2
coverage-target: 75
---

## Problem Statement

IT teams have no central, auditable record of which employee holds which company
laptop. Assignments are tracked in spreadsheets, returns go unrecorded, and
hardware audits require manual cross-referencing.

## Solution

Extend the standard Salesforce `Asset` object with a custom `AssignedUser__c`
lookup field and a curated `Status` picklist. IT Admins manage the full laptop
inventory through standard list views and record pages. Employees see only their
own assigned laptops via a dedicated `myLaptops` LWC surfaced on a Lightning App
page. A Record-Triggered Flow sends email notifications to employees on
assignment and return.

## User Stories

- US-1: As an IT Admin, I want to create a laptop record with a serial number and status, so that the asset is tracked in Salesforce.
- US-2: As an IT Admin, I want to assign an available laptop to an employee, so that ownership is recorded.
- US-3: As an IT Admin, I want to record a laptop return, so that the asset becomes available again.
- US-4: As an IT Admin, I want to view a full inventory list with current assignees, so that I can audit hardware without leaving Salesforce.
- US-5: As an Employee, I want to see only my assigned laptops, so that I can confirm what is checked out to me.
- US-6: As an Employee, I want to receive an email when a laptop is assigned to me, so that I am notified promptly.
- US-7: As an Employee, I want to receive an email when my laptop is returned, so that I have a record of the return.

## Acceptance Criteria

- AC-1 (US-1): Given an IT Admin user, when they insert an Asset with a Name, SerialNumber, and Status=Available, then the record saves successfully and Status is Available. [verify: apex]
- AC-2 (US-2): Given an Asset with Status=Available, when an IT Admin sets AssignedUser__c to an employee and Status to Assigned and saves, then Status is Assigned and AssignedUser__c is populated with that employee. [verify: apex]
- AC-3 (US-3): Given an Asset with Status=Assigned, when an IT Admin clears AssignedUser__c and sets Status to Available and saves, then Status is Available and AssignedUser__c is null. [verify: apex]
- AC-4 (US-1): Given an Asset with Status=Retired, when an IT Admin attempts to set Status=Assigned, then a validation rule throws an error and the save is blocked. [verify: apex]
- AC-5 (US-4): Given multiple Assets with mixed statuses, when an IT Admin queries all Assets, then all records are returned regardless of AssignedUser__c value. [verify: apex]
- AC-6 (US-5): Given an employee has one assigned laptop, when getMyLaptops() is called in their context, then exactly that asset is returned and no others. [verify: apex]
- AC-7 (US-5): Given Employee A and Employee B each have a laptop assigned, when Employee A calls getMyLaptops(), then Employee B's laptop is absent from the result. [verify: apex]
- AC-8 (US-1): Given a user without the AssetTracker_ITAdmin permission set, when they query all Assets using WITH USER_MODE, then they can only see records they own and cannot see records owned by other users. [verify: apex]
- AC-9 (US-5): Given the myLaptops component is rendered, when it is assessed with Sa11y, then it passes all accessibility checks. [verify: a11y]
- AC-10 (US-5): Given the myLaptops component is rendered with mock asset data, when the component initialises, then it displays the Name, SerialNumber, and Status for each assigned asset. [verify: jest]
- AC-11 (US-6): Given a laptop is assigned to an employee, when the record is saved, then an email notification is sent to that employee; Flow email delivery cannot be asserted by Apex or Jest tests. [verify: manual]
- AC-12 (US-7): Given an assigned laptop is returned (AssignedUser__c cleared, Status becomes Available), when the record is saved, then an email notification is sent to the previously assigned employee; Flow email delivery cannot be asserted by Apex or Jest tests. [verify: manual]

## Data Model

Driven by ADR-001. No new custom objects. One custom field added to the standard
`Asset` object.

**Asset (standard object)**

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Asset Name | Name | Text(255) | Laptop model or identifier |
| Serial Number | SerialNumber | Text(255) | Unique hardware serial number |
| Status | Status | Picklist | Values: Available, Assigned, Retired |
| Purchase Date | PurchaseDate | Date | When the laptop was purchased |
| Price | Price | Currency(16,2) | Purchase cost |
| Assigned User | AssignedUser__c | Lookup(User) | Custom field; null when unassigned |

**Validation Rule on Asset**

| Rule | Formula | Error |
|------|---------|-------|
| No_Assign_Retired | `AND(ISPICKVAL(Status, "Assigned"), ISPICKVAL(PRIORVALUE(Status), "Retired"))` | "A retired laptop cannot be assigned." |

## Security Model

Driven by ADR-002 and ADR-003.

**Object-Level Defaults**

| Object | OWD |
|--------|-----|
| Asset | Private |

**Permission Sets**

| Permission Set | Object | Permissions | Fields |
|----------------|--------|-------------|--------|
| AssetTracker_ITAdmin | Asset | Read, Create, Edit, Delete, View All, Modify All | All |
| AssetTracker_Employee | Asset | Read | Name, SerialNumber, Status, AssignedUser__c |

**Sharing**

No metadata sharing rule. `AssetTrackerController` runs `without sharing` and
enforces employee data isolation via an explicit `WHERE AssignedUser__c = :UserInfo.getUserId()`
filter (ADR-006). The Private OWD ensures employees cannot read Asset records
through any path other than the controller. The `AssetTracker_Employee` PS is still
required for object-level Read access.

**Apex**

`AssetTrackerController` runs `without sharing`. The `WHERE AssignedUser__c = :UserInfo.getUserId()`
SOQL filter is the security boundary for the employee view. IT Admin queries use
`WITH USER_MODE` to enforce FLS.

## Observability

- **Flow errors:** The Record-Triggered Flow has a fault path that sends a fault
  email to the org administrator via Salesforce's built-in Flow error email
  (Setup > Process Automation Settings). Admins can inspect failed interviews in
  Setup > Flows > [flow name] > View Detail.
- **Apex errors:** Uncaught exceptions surface in the browser console and are
  visible in the debug log (Setup > Debug Logs) when a log is active for the
  running user.
- **No custom platform events or logging framework needed** at this scope.

## Definition of Done

| Item | Gate | Notes |
|------|------|-------|
| Accessibility passes Sa11y on myLaptops | a11y | AC-9 |
| Apex test coverage ≥ 75 % on AssetTrackerController | apex-tests | ACs 1–8 |
| myLaptops Jest suite passes | lwc-jest | AC-10 |
| Metadata deploys cleanly to blitzafv2 | deployable | deploy gate |
| Code Analyzer reports zero P1/P2 findings | code-analyzer | Apex + LWC |
| npm audit reports no high/critical vulnerabilities | npm-audit | LWC package |
| Service abstraction | N/A | No external API calls |
| Auth (external) | N/A | Salesforce handles authentication |
| Localization / Globalization | N/A | Internal English-only tool |
| Brand tokens | N/A | Standard SLDS; no custom brand |
| LCP budget | N/A | Internal Lightning page |
| HTTP error codes | N/A | No custom REST endpoints |
| SEO / Sitemap | N/A | Internal authenticated app |
| Coded UI tests | N/A | Selenium/WebDriver out of scope |
| Scale tests | N/A | Fleet <1 000 records |
| Agent readiness | N/A | No agent interface |

## Out of Scope

- Mobile app or Experience Cloud portal for employees.
- Hardware procurement, purchasing workflow, or PO integration.
- Repair tracking or maintenance scheduling.
- Integration with an MDM or asset management system.
