# TASK_TEMPLATE.md

Purpose of this file:

Standard task format for Claude Code to ensure:
- minimal token usage
- stable implementation
- minimal repo scanning
- predictable delivery format

Claude must follow this structure when receiving a task.

---

# 1 Task Overview

Describe the task briefly.

Example:

Add a new field to vehicle quote items to store license plate number.

---

# 2 Task Type

Specify the task category:

- feature
- bugfix
- refactor
- schema-change
- UI-change
- calculation-change
- persistence-change

Claude must adjust reading scope based on task type.

---

# 3 Relevant Files (IMPORTANT)

List only the files that should be inspected first.

Example:

server/services/quoteService.js  
server/app.js  
web/vehicle-quote.js  

Claude must read these files before scanning the repository.

Avoid scanning unrelated directories.

---

# 4 Implementation Requirements

Describe the exact behavior required.

Example:

Vehicle quote rows must support a new optional field:

licensePlate

Rules:

- field must be optional
- must not break existing quotes
- must appear in API responses
- must persist to storage

---

# 5 Compatibility Requirements

All new logic must preserve compatibility.

Rules:

- old records must remain readable
- missing fields must not break UI
- missing fields must not break calculations

Safe patterns:

value ?? ''  
Number(value ?? 0)

---

# 6 Database / Persistence Impact

If persistence is involved:

Specify whether the change affects:

- JSON persistence
- Supabase schema
- both

Example:

JSON persistence must store the new field.

Supabase schema should add:

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS license_plate TEXT;

---

# 7 Business Logic Impact

If calculations change, describe expected results.

Example:

Vehicle item totals must remain unchanged.

The new field is informational only.

---

# 8 Testing Expectations

Explain what must still work.

Example:

- existing quotes load correctly
- new quotes save correctly
- totals calculation unchanged
- API responses include new field

---

# 9 Implementation Constraints

Claude must follow these constraints:

- prefer minimal patch
- avoid large refactors
- reuse existing patterns
- do not introduce new dependencies
- maintain Node built-in only backend

---

# 10 Delivery Format

Claude must finish the task with the following structure.

### Modified Files

list of files changed

### Logic Changes

describe main implementation changes

### Data / Schema Impact

describe persistence changes

### Compatibility Handling

explain how old data still works

### Local Testing Steps

step-by-step verification

### Deployment Notes

whether deployment is required

### Risks

possible side effects

---

# 11 Example Task

Example request using this template:

Task Overview

Add support for optional vehicle license plate field.

Task Type

feature

Relevant Files

server/app.js  
server/services/quoteService.js  
web/vehicle-quote.js  

Implementation Requirements

Vehicle rows must support optional field:

licensePlate

Compatibility Requirements

Existing quotes without licensePlate must still load normally.

Business Logic Impact

No impact on totals calculation.

Testing Expectations

Existing vehicle quotes must remain unchanged.

Implementation Constraints

Minimal patch only.
