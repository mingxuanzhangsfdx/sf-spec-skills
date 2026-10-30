# Intent

## Problem

IT teams have no central, auditable record of which employee holds which company
laptop. Assignments are tracked in spreadsheets, returns go unrecorded, and
hardware audits require manual cross-referencing.

## Users

| Persona | Need |
|---------|------|
| **IT Admin** | Create laptop records, assign to employees, record returns, view full inventory |
| **Employee** | See which laptops are currently assigned to them (read-only) |

## Outcomes

- An IT Admin can assign an available laptop to an employee in under 60 seconds.
- An employee receives an email notification within 5 minutes of assignment or return.
- Every laptop has an auditable Status (`Available`, `Assigned`, `Retired`) at all times.
- An IT Admin can produce a full inventory list with current assignees without leaving Salesforce.

## Constraints

- Build on the existing `blitzafv2` Enterprise Edition sandbox.
- Use standard Salesforce metadata (deployable via `sf project deploy`).
- No external systems or integrations in scope.

## Non-goals

- Mobile app or Experience Cloud portal for employees.
- Hardware procurement, purchasing workflow, or PO integration.
- Repair tracking or maintenance scheduling.
- Integration with an MDM or asset management system.

## Open questions

None.
