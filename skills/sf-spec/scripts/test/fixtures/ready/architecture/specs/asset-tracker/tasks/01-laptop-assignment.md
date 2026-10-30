---
id: T01
title: Laptop record, assignment service, admin permission set
skills: platform-custom-object-generate, platform-apex-generate, platform-apex-test-generate, platform-permission-set-generate
covers: AC-1, AC-2, AC-5
blocked-by: none
status: done
---
## What to build
Laptop__c, LaptopService.assign, and the Laptop_Admin permission set.

## How it proves its ACs
LaptopServiceTest.ac1AssignAvailableLaptop and ac2RejectRetiredLaptop; AC-5 by a clean deploy.

## Delivered
- force-app/main/default/objects/Laptop__c/
- `force-app/main/default/classes/LaptopService.cls`
- force-app/main/default/classes/LaptopServiceTest.cls, force-app/main/default/classes/LaptopTestFactory.cls
- force-app/main/default/permissionsets/Laptop_Admin.permissionset-meta.xml.
- Deploy 0AfFAKE000001 · tests 2/2 passed
