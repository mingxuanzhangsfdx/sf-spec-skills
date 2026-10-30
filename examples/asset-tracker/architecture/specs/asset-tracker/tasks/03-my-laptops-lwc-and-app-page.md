---
id: T03
title: myLaptops LWC, Jest, a11y and App Page
skills: experience-lwc-generate, experience-lwc-base-components-integrate, experience-lwc-accessibility-jest-run, platform-flexipage-generate, platform-custom-application-generate, platform-metadata-api-context-get
covers: AC-9, AC-10
blocked-by: T01
status: done
---

## What to build

`myLaptops` LWC — calls `AssetTrackerController.getMyLaptops()` via `@wire`,
displays results in a `lightning-datatable` with columns Name, SerialNumber,
Status; shows an empty-state message when no laptops are assigned:

- `force-app/main/default/lwc/myLaptops/myLaptops.html`
- `force-app/main/default/lwc/myLaptops/myLaptops.js`
- `force-app/main/default/lwc/myLaptops/myLaptops.js-meta.xml`

Jest test suite (with Sa11y for a11y AC):

- `force-app/main/default/lwc/myLaptops/__tests__/myLaptops.test.js`

Lightning App Page hosting the component, visible to AssetTracker_Employee PS:

- `force-app/main/default/flexipages/AssetTrackerEmployeePage.flexipage-meta.xml`

Lightning Application and tab so the page is reachable:

- `force-app/main/default/applications/AssetTracker.app-meta.xml`
- `force-app/main/default/tabs/myLaptops.tab-meta.xml`

## How it proves its ACs

Both ACs are proven in `myLaptops.test.js`:

- `it('AC-10: displays Name, SerialNumber, and Status columns', ...)` — mocks the `@wire` adapter with two asset records; asserts `lightning-datatable` receives a `columns` prop containing Name, SerialNumber, and Status, and a `data` prop with both records.
- `it('AC-9: myLaptops component is accessible', ...)` — renders the component with mock data using `@sa11y/jest`'s `toBeAccessible` matcher; asserts no accessibility violations.

## Delivered

All ACs proven by Jest. 3/3 tests pass including Sa11y accessibility check.

force-app/main/default/lwc/myLaptops/myLaptops.html
force-app/main/default/lwc/myLaptops/myLaptops.js
force-app/main/default/lwc/myLaptops/myLaptops.js-meta.xml
force-app/main/default/lwc/myLaptops/__tests__/myLaptops.test.js

**Artifacts present locally, not yet activated in org (see note below):**
- `AssetTrackerEmployeePage` FlexiPage — created; deploy blocked by org-level template issue
- `myLaptops` CustomTab — created; references FlexiPage (blocked by FlexiPage)
- `AssetTracker` CustomApplication — created; references Tab (blocked by FlexiPage)

**Note — App Page template not registered in org:** This org's metadata only exposes `UtilityBar` and `RecordPage` FlexiPage templates. The standard `lightning_AppPage_1Column` template is absent, causing a deploy error "Template c:lightning_AppPage_1Column doesn't exist." Activate the App Page via Lightning App Builder in the org Setup UI: New App Page → select 1-Column layout → add `c:myLaptops` component.
