---
id: T01
title: Asset schema and IT Admin baseline
skills: platform-custom-field-generate, platform-sharing-owd-configure, platform-validation-rule-generate, platform-permission-set-generate, platform-apex-test-generate, platform-metadata-api-context-get
covers: AC-1, AC-4, AC-5, AC-8
blocked-by: none
status: done
---

## What to build

Custom field on the standard Asset object:

- `force-app/main/default/objects/Asset/fields/AssignedUser__c.field-meta.xml`
  — Lookup(User), label "Assigned User", not required

Status picklist values for Asset (Available, Assigned, Retired):

- `force-app/main/default/objects/Asset/listViews/` — update or leave to org default

Validation rule blocking assignment of a Retired asset:

- `force-app/main/default/objects/Asset/validationRules/No_Assign_Retired.validationRule-meta.xml`

IT Admin permission set (Asset: Read, Create, Edit, Delete, View All, Modify All; all fields including AssignedUser__c):

- `force-app/main/default/permissionsets/AssetTracker_ITAdmin.permissionset-meta.xml`

Apex test class (no controller yet — tests CRUD and permission guard directly via DML):

- `force-app/main/default/classes/AssetTrackerControllerTest.cls`
- `force-app/main/default/classes/AssetTrackerControllerTest.cls-meta.xml`

## How it proves its ACs

All four ACs are proven in `AssetTrackerControllerTest`:

- `ac1CreateAvailableLaptop` — System.runAs IT Admin user with AssetTracker_ITAdmin PS, inserts Asset with Status=Available; asserts no exception and Status equals Available.
- `ac4BlockAssignRetiredAsset` — inserts an Asset with Status=Retired, then attempts to update Status=Assigned; asserts a DMLException is thrown containing the validation error message.
- `ac5ITAdminSeesAllAssets` — inserts two Assets assigned to different users; System.runAs IT Admin; queries [SELECT Id FROM Asset]; asserts count equals 2.
- `ac8NonAdminCannotInsertAsset` — System.runAs a plain user with no permission set; attempts to insert an Asset; asserts an AuraHandledException or DMLException is thrown.

## Delivered

force-app/main/default/objects/Asset/Asset.object-meta.xml (sharingModel → Private, externalSharingModel → Private)
force-app/main/default/objects/Asset/fields/AssignedUser__c.field-meta.xml
force-app/main/default/standardValueSets/AssetStatus.standardValueSet-meta.xml (Added Available, Assigned, Retired)
force-app/main/default/objects/Asset/validationRules/No_Assign_Retired.validationRule-meta.xml
force-app/main/default/permissionsets/AssetTracker_ITAdmin.permissionset-meta.xml
force-app/main/default/classes/AssetTrackerControllerTest.cls
force-app/main/default/classes/AssetTrackerControllerTest.cls-meta.xml

Deploy ID: 0AfWI00000LNhpm0AD

Tests passed:
- AssetTrackerControllerTest.ac1CreateAvailableLaptop
- AssetTrackerControllerTest.ac4BlockAssignRetiredAsset
- AssetTrackerControllerTest.ac5ITAdminSeesAllAssets
- AssetTrackerControllerTest.ac8NonAdminCannotSeeOtherOwnersAssets

Spec change: AC-8 updated (ADR-005) — security boundary is visibility isolation, not insert-block.
