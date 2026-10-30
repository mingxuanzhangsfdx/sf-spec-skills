---
feature: asset-tracker
status: ready            # draft | ready | building | delivered
target-org: fakeDev
---
# Asset tracker

## Problem Statement
Laptop assignments live in a spreadsheet that IT and employees cannot trust.

## Solution
A Laptop__c object, an assignment service, and a My Laptops component.

## User Stories
- US-1: As an IT admin, I want to assign an available laptop to an employee, so that ownership is recorded.
- US-2: As an employee, I want to see the laptops assigned to me, so that I know what I hold.
- US-3: As an IT admin, I want access granted by permission set, so that only IT can reassign laptops.

## Acceptance Criteria
- AC-1 (US-1): Given an available laptop, when an IT admin assigns it to an employee, then its status becomes Assigned and the employee is recorded. [verify: apex]
- AC-2 (US-1): Given a retired laptop, when an IT admin tries to assign it, then the assignment is rejected with an error.
- AC-3 (US-2): Given laptops assigned to several employees, when an employee opens My Laptops, then only their laptops are listed. [verify: jest]
- AC-4 (US-2): Given the My Laptops component, when it renders, then it has no Sa11y violations. [verify: a11y]
- AC-5 (US-3): Given the Laptop_Admin permission set, when it is deployed, then it grants edit on Laptop__c. [verify: deploy]
- AC-6 (US-3): Given an IT admin, when they open the App Launcher, then the Asset Tracker app is visible. [verify: manual]

## Data Model
- Laptop__c: Serial_Number__c (Text, unique), Status__c (Available | Assigned | Retired), Assigned_To__c (Lookup User).

## Security Model
- Laptop_Admin permission set grants CRUD on Laptop__c; OWD Private; Apex runs with sharing and user-mode DML.

## Observability
- Assignment failures throw LaptopService.LaptopException carrying the laptop id.

## Definition of Done
- Code Analyzer has no sev1/sev2, Apex coverage is at least 75%, Sa11y passes, npm audit has no high/critical.

## Out of Scope
- Procurement and depreciation.
