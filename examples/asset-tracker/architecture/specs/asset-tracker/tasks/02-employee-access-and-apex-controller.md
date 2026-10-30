---
id: T02
title: Employee access and Apex controller
skills: platform-apex-generate, platform-apex-test-generate, platform-permission-set-generate, platform-metadata-api-context-get
covers: AC-2, AC-3, AC-6, AC-7
blocked-by: T01
status: done
---

## What to build

Employee permission set (Asset: Read; fields: SerialNumber, Status, AssignedUser__c):

- `force-app/main/default/permissionsets/AssetTracker_Employee.permissionset-meta.xml`

Apex controller with a single `@AuraEnabled(cacheable=true)` method `getMyLaptops()` that returns `List<Asset>` for the running user; runs `with sharing`, uses `WITH USER_MODE` in SOQL:

- `force-app/main/default/classes/AssetTrackerController.cls`
- `force-app/main/default/classes/AssetTrackerController.cls-meta.xml`

Extend `AssetTrackerControllerTest` with assign/return and employee isolation tests.

## How it proves its ACs

Methods added to `AssetTrackerControllerTest`:

- `ac2AssignAvailableLaptop` — System.runAs IT Admin; creates an Asset with Status=Available, then updates AssignedUser__c and Status=Assigned; asserts Status equals Assigned and AssignedUser__c is populated.
- `ac3ReturnAssignedLaptop` — System.runAs IT Admin; starts from Status=Assigned with AssignedUser__c set, then clears AssignedUser__c and sets Status=Available; asserts Status equals Available and AssignedUser__c is null.
- `ac6EmployeeSeesOwnLaptop` — creates an Asset assigned to Employee A; System.runAs Employee A; calls AssetTrackerController.getMyLaptops(); asserts result size equals 1 and the returned asset Id matches.
- `ac7EmployeeCannotSeeOtherLaptop` — creates an Asset assigned to Employee B; System.runAs Employee A (different user); calls AssetTrackerController.getMyLaptops(); asserts result is empty.

## Delivered

All 4 T02 ACs verified. 8/8 tests passing; `AssetTrackerController` at 100% coverage.

**Root cause fixed during build:** `AssetTracker_ITAdmin` PS lacked explicit FLS edit on `Asset.AssignedUser__c`. `viewAllFields=true` grants read-only bypass; custom field edits require an explicit `<editable>true</editable>` `fieldPermissions` entry. Added and redeployed.

force-app/main/default/permissionsets/AssetTracker_Employee.permissionset-meta.xml
force-app/main/default/classes/AssetTrackerController.cls
force-app/main/default/classes/AssetTrackerController.cls-meta.xml
force-app/main/default/classes/AssetTrackerControllerTest.cls (extended with ac2, ac3, ac6, ac7)
force-app/main/default/permissionsets/AssetTracker_ITAdmin.permissionset-meta.xml (added Asset.AssignedUser__c field edit FLS)
