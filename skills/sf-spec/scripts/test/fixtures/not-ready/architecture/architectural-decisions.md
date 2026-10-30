# Architectural decisions

## ADR-001: Custom object for laptops
- Status: Accepted
- Context: Nothing in the org models a laptop and its holder.
- Decision: Create Laptop__c with a Status__c picklist and an Assigned_To__c user lookup.
- Consequences: One object to secure and test.
- Reuse checked: standard Asset (requires Account/Contact, wrong shape); no Laptop__c in the org.
