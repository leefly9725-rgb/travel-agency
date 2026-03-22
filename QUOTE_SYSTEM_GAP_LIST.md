# QUOTE_SYSTEM_GAP_LIST.md

Project: 泷鼎晟国际旅行社运营系统 V1.0

Purpose of this file:
- compare the current quote system against the target blueprint
- identify missing fields, missing modules, and missing logic
- define the next best implementation priorities
- help Claude Code choose the correct task scope

---

## 1. Current Target Model Reference

This file should be read together with:

- `CLAUDE.md`
- `PROJECT_MAP.md`
- `QUOTE_DATA_BLUEPRINT.md`

The target direction is:

- one quote
- many quote items
- each item has many detail rows
- totals aggregate from row -> item -> quote
- all quote data remains backward compatible

---

## 2. Current Known Implemented State

Based on current project progress already discussed, the following areas are known or strongly expected to exist:

### Infrastructure
- Vercel deployment exists
- GitHub repository exists
- Supabase environment exists
- local Node server exists
- active project development is ongoing

### Quote system
- quotation system base already exists
- hotel-related detail structure has been worked on
- vehicle-related detail structure has been worked on
- guide / interpreter-related detail structure has been worked on
- quotation module is already a core development focus

### Important note
The exact final code implementation may still differ from the blueprint.
Claude Code must verify relevant files before changing anything.

---

## 3. Gap Evaluation Method

Each area should be evaluated using the following statuses:

- `DONE` = already implemented and generally aligned
- `PARTIAL` = implemented but incomplete / inconsistent / missing layers
- `MISSING` = not implemented yet
- `VERIFY` = likely exists but must inspect code first

Claude Code must verify actual code before assuming status.

---

## 4. Quote-Level Structure Gap List

### 4.1 Core identity
- `id` -> VERIFY
- `quoteNo` -> VERIFY
- `projectId` -> VERIFY
- `customerId` -> VERIFY

### 4.2 Display/business fields
- `customerName` -> VERIFY
- `title` -> VERIFY
- `status` -> PARTIAL
- `currency` -> VERIFY
- `date` -> VERIFY
- `validUntil` -> MISSING
- `language` -> PARTIAL

### 4.3 Notes
- `notes` -> VERIFY
- `internalNotes` -> MISSING

### 4.4 Aggregate payload
- `items` -> DONE
- `totals.cost` -> VERIFY
- `totals.price` -> VERIFY
- `totals.grossProfit` -> VERIFY
- `totals.grossMargin` -> VERIFY

### 4.5 Audit
- `createdAt` -> VERIFY
- `updatedAt` -> VERIFY

---

## 5. Item-Level Structure Gap List

Shared item-level fields target:

- `id` -> VERIFY
- `type` -> DONE
- `title` -> PARTIAL
- `serviceDate` -> PARTIAL
- `startDate` -> PARTIAL
- `endDate` -> PARTIAL
- `currency` -> PARTIAL
- `remarks` -> PARTIAL
- `details` -> DONE
- `totals.cost` -> VERIFY
- `totals.price` -> VERIFY
- `totals.grossProfit` -> VERIFY
- `totals.grossMargin` -> VERIFY

### Common likely gap
Some item types may already have working detail rows but may not yet have fully unified:
- naming conventions
- totals shape
- remarks handling
- default values
- safe normalization

Status:
- unified item schema -> PARTIAL

---

## 6. Hotel Module Gap List

Target capability:
- hotel item has detail rows
- each row supports roomType / roomCount / nights / cost / price
- row totals aggregate correctly
- old hotel quotes remain compatible

### Current assessment
- hotel detail row model -> PARTIAL
- `roomType` -> VERIFY
- `roomCount` -> VERIFY
- `nights` -> VERIFY
- `cost` -> PARTIAL
- `price` -> PARTIAL
- `subtotalCost` -> MISSING or PARTIAL
- `subtotalPrice` -> MISSING or PARTIAL
- row `remarks` -> PARTIAL
- item totals aggregation -> VERIFY
- frontend form support -> VERIFY
- backend normalization -> PARTIAL
- persistence support -> VERIFY
- preview/export mapping -> VERIFY

### Recommendation
Hotel should be treated as:
- structurally present
- still needing unification and hardening

Status:
- hotel module overall -> PARTIAL

---

## 7. Vehicle Module Gap List

Target capability:
- multi-row vehicle services
- row fields such as serviceType / vehicleType / quantity / pricingUnit / cost / price
- correct item/quote totals
- backward compatibility

### Current assessment
- vehicle detail row model -> PARTIAL
- `serviceType` -> VERIFY
- `vehicleType` -> VERIFY
- `quantity` -> VERIFY
- `pricingUnit` -> VERIFY
- `cost` -> PARTIAL
- `price` -> PARTIAL
- `subtotalCost` -> MISSING or PARTIAL
- `subtotalPrice` -> MISSING or PARTIAL
- row `remarks` -> PARTIAL
- item totals aggregation -> VERIFY
- frontend form support -> VERIFY
- backend normalization -> PARTIAL
- persistence support -> VERIFY
- preview/export mapping -> VERIFY

Status:
- vehicle module overall -> PARTIAL

---

## 8. Guide / Interpreter Module Gap List

Target capability:
- guide / interpreter service rows
- row fields: role / language / serviceDuration / quantity / cost / price
- compatible with old records

### Current assessment
- guide/interpreter row model -> PARTIAL
- `role` -> PARTIAL
- `language` -> VERIFY
- `serviceDuration` -> VERIFY
- `quantity` -> PARTIAL
- `cost` -> PARTIAL
- `price` -> PARTIAL
- `subtotalCost` -> MISSING or PARTIAL
- `subtotalPrice` -> MISSING or PARTIAL
- row `remarks` -> PARTIAL
- item totals aggregation -> VERIFY
- frontend form support -> VERIFY
- backend normalization -> PARTIAL
- persistence support -> VERIFY
- preview/export mapping -> VERIFY

Status:
- guide / interpreter module overall -> PARTIAL

---

## 9. Other Service Module Gap List

Target modules not yet confirmed as complete:

### Dining
- module structure -> MISSING or VERIFY
- detail rows -> MISSING
- cost/price/totals -> MISSING

### Tickets
- module structure -> MISSING or VERIFY
- detail rows -> MISSING
- cost/price/totals -> MISSING

### Meeting
- module structure -> MISSING or VERIFY
- detail rows -> MISSING
- cost/price/totals -> MISSING

### Parking
- module structure -> MISSING or VERIFY
- detail rows -> MISSING
- cost/price/totals -> MISSING

### Misc
- module structure -> VERIFY
- detail rows -> PARTIAL or MISSING
- cost/price/totals -> PARTIAL or MISSING

Overall status:
- secondary service modules -> MISSING / PARTIAL

---

## 10. Cost / Price / Profit Logic Gap List

Target direction:
- every relevant detail row supports `cost`
- every relevant detail row supports `price`
- row totals aggregate into item totals
- quote totals are derived from item totals
- profit fields are calculated, not manually trusted

### Current assessment
- row-level `cost` support across modules -> PARTIAL
- row-level `price` support across modules -> PARTIAL
- item total cost aggregation -> VERIFY
- item total price aggregation -> VERIFY
- quote total cost aggregation -> VERIFY
- quote total price aggregation -> VERIFY
- `grossProfit` derivation -> VERIFY
- `grossMargin` derivation -> VERIFY
- unified row subtotal model -> PARTIAL

### Key likely gap
Even if totals work, row-level formulas and field naming may still be inconsistent.

Status:
- cost/price/profit system -> PARTIAL

---

## 11. Normalization Gap List

Target direction:
- old records must continue working
- missing fields must not break UI
- missing fields must not break calculations
- backend should normalize quote/item/row structure safely

### Current assessment
- quote-level normalization -> VERIFY
- item-level normalization -> PARTIAL
- hotel row normalization -> PARTIAL
- vehicle row normalization -> PARTIAL
- guide/interpreter row normalization -> PARTIAL
- default empty string / zero fallback -> PARTIAL
- legacy data tolerance -> PARTIAL

Status:
- normalization overall -> PARTIAL

---

## 12. Persistence Gap List

Current reality:
- JSON persistence is active
- Supabase schema exists but may not yet be primary

### Current assessment
- JSON persistence for quote core fields -> DONE
- JSON persistence for newer detail row fields -> VERIFY
- backward-compatible read behavior -> PARTIAL
- Supabase alignment with new quote structure -> PARTIAL
- schema mapping for row-level fields -> PARTIAL

Status:
- persistence layer overall -> PARTIAL

---

## 13. Preview / Export Gap List

Target direction:
- preview output should reflect stable quote structure
- key quote fields and item detail fields should be available for document output

### Current assessment
- base preview system exists -> DONE
- quote preview compatibility with newer detail fields -> PARTIAL
- hotel row preview mapping -> PARTIAL
- vehicle row preview mapping -> PARTIAL
- guide/interpreter preview mapping -> PARTIAL
- cost/price visibility rules in output -> VERIFY

Status:
- preview/export overall -> PARTIAL

---

## 14. Testing Gap List

Target direction:
- quote calculation changes should be covered
- API shape should remain stable
- old data compatibility should be validated

### Current assessment
- quote service tests exist -> DONE
- API tests exist -> DONE
- row-level module-specific tests -> PARTIAL
- old/new mixed-data compatibility tests -> MISSING
- hotel-specific subtotal tests -> MISSING or PARTIAL
- vehicle-specific subtotal tests -> MISSING or PARTIAL
- guide/interpreter subtotal tests -> MISSING or PARTIAL

Status:
- testing for quote evolution -> PARTIAL

---

## 15. Highest-Value Next Tasks

These are the best next implementation priorities for the quote system.

### Priority 1
Unify row-level cost / price / subtotal structure across:
- hotel
- vehicle
- guide / interpreter

Reason:
This produces the highest stability gain with the best future extensibility.

Status:
- recommended next task -> HIGH PRIORITY

### Priority 2
Strengthen backend normalization for:
- missing fields
- old rows
- mixed old/new quote data

Reason:
This reduces production risk and prevents UI/calculation errors.

Status:
- recommended next task -> HIGH PRIORITY

### Priority 3
Add focused tests for:
- hotel subtotal aggregation
- vehicle subtotal aggregation
- guide/interpreter subtotal aggregation
- mixed legacy/new quote data

Reason:
This protects future development speed.

Status:
- recommended next task -> HIGH PRIORITY

### Priority 4
Expand secondary service modules:
- dining
- tickets
- meeting
- parking
- misc

Reason:
These are useful, but only after the primary quote structure is stable.

Status:
- recommended next task -> MEDIUM PRIORITY

### Priority 5
Improve preview/export mapping for new stable row fields

Reason:
Should follow after structure stabilizes.

Status:
- recommended next task -> MEDIUM PRIORITY

---

## 16. Recommended Task-File Mapping

When the next task is chosen, prefer the following task files:

### If adding or unifying hotel row fields
Use:
- `tasks/quote/task-add-hotel-row.md`

### If adding or unifying vehicle row fields
Use:
- `tasks/quote/task-add-vehicle-row.md`

### If adding or unifying guide/interpreter row fields
Use:
- `tasks/quote/task-add-guide-row.md`

### If improving cost support
Use:
- `tasks/quote/task-add-cost-price.md`

### If improving sale price support
Use:
- `tasks/quote/task-add-sale-price.md`

### If adjusting calculation logic
Use:
- `tasks/task-adjust-quote-calculation.md`

---

## 17. Recommended Current Strategy

At the current project stage, the best implementation strategy is:

1. stabilize primary modules first
   - hotel
   - vehicle
   - guide/interpreter

2. unify cost / price / subtotal model

3. strengthen normalization and tests

4. only then expand additional service modules

This is the most cost-effective path for:
- stability
- development speed
- Claude Code efficiency
- backward compatibility

---

## 18. Maintenance Rule

Update this file when:
- a major quote module becomes stable
- a missing field becomes implemented
- a major gap is closed
- the next development priority changes

Do not use this file for temporary brainstorming.
Use it as the current development truth for quote-system gaps.
