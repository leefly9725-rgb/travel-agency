# QUOTE_DATA_BLUEPRINT.md

Project: 泷鼎晟国际旅行社运营系统 V1.0

Purpose of this file:
- define the stable quote system data blueprint
- align frontend input, backend normalization, persistence, and calculation
- reduce ambiguity for Claude Code
- preserve backward compatibility while supporting future expansion

---

## 1. Design Principles

The quote system must follow these principles:

- practical for real travel-agency operations
- easy for fast manual input
- backward compatible
- safe for partial / missing fields
- expandable without rewriting the entire structure

The quote system is divided into:

1. quote-level data
2. item-level data
3. detail-row-level data

Calculations happen from:
detail row -> item -> quote

---

## 2. Quote Object Overview

A quote represents one business quotation project.

Recommended structure:

```json
{
  "id": "quote_xxx",
  "quoteNo": "Q2026-001",
  "projectId": "project_xxx",
  "customerId": "customer_xxx",
  "customerName": "",
  "title": "",
  "status": "draft",
  "currency": "EUR",
  "date": "2026-03-14",
  "validUntil": "",
  "language": "zh",
  "notes": "",
  "internalNotes": "",
  "items": [],
  "totals": {
    "cost": 0,
    "price": 0,
    "grossProfit": 0,
    "grossMargin": 0
  },
  "createdAt": "",
  "updatedAt": ""
}
