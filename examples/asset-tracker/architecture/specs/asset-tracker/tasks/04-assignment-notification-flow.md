---
id: T04
title: Assignment notification Flow
skills: automation-flow-generate, platform-metadata-api-context-get
covers: AC-11, AC-12
blocked-by: T01
status: done
---

## What to build

Record-Triggered Flow on Asset, fires after save when `AssignedUser__c` changes
or `Status` changes to/from `Assigned`. Two paths:

1. **Assignment path** — `AssignedUser__c` is newly populated: send email to the
   user referenced by `AssignedUser__c` notifying them of the assignment.
2. **Return path** — `AssignedUser__c` was populated and is now cleared (Status
   moves away from Assigned): send email to the user referenced by the prior
   value of `AssignedUser__c` notifying them of the return.

Fault path routes to an Admin fault email action so errors surface in Setup.

- `force-app/main/default/flows/AssetAssignmentNotification.flow-meta.xml`

## How it proves its ACs

AC-11 and AC-12 are tagged `[verify: manual]`. An IT Admin confirms by:

1. Assigning a laptop to an employee in the target org and verifying the employee
   receives an email with the laptop's name and serial number.
2. Returning the laptop (clearing AssignedUser__c) and verifying the employee
   receives a return confirmation email.

The `deployable` scorecard gate confirms the flow metadata deploys cleanly. No
automated test can assert Flow email delivery.

## Delivered

Flow deployed to blitzafv2 (Deploy ID: 0AfWI00000LNnIT0A1). Status: Active.

force-app/main/default/flows/AssetAssignmentNotification.flow-meta.xml

**Flow structure:**
- Trigger: RecordAfterSave on Asset, fires when `AssignedUser__c` changes (`ISCHANGED` filter)
- Decision: Newly Assigned (AssignedUser__c now non-null, was null) → Get Assigned User → Send Assignment Email
- Decision: Laptop Returned (AssignedUser__c now null, was non-null) → Get Prior User → Send Return Email
- Fault connectors on all Get/Send elements → Send Fault Email to `$User.Email` (the triggering user / IT Admin)
- Neither path (reassignment between two users) → no action (no-op end)

**AC-11 and AC-12 require manual verification:** assign a laptop to an employee in the org and confirm the employee receives an email with laptop Name and SerialNumber; then return it and confirm the return email.

**Note — `execute_metadata_action` MCP tool unavailable:** The `automation-flow-generate` skill requires this tool for its 3-step pipeline. Since the MCP server was not connected in this session, the Flow XML was authored manually. The flow deployed and validated cleanly.
