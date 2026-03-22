-- 商务条款模块 V1 — Supabase 数据库迁移
-- 执行时机：部署前在 Supabase SQL Editor 运行一次
-- 兼容性：全部使用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行

-- 1. 在 quotes 表新增 terms_snapshot 字段
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS terms_snapshot JSONB;

-- 2. 创建全局默认模板表
CREATE TABLE IF NOT EXISTS business_terms_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL DEFAULT '默认模板',
  is_default boolean     DEFAULT true,
  snapshot   JSONB       NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 确保同一时间只有一个 is_default=true 的模板（可选约束）
CREATE UNIQUE INDEX IF NOT EXISTS business_terms_templates_default_idx
  ON business_terms_templates (is_default)
  WHERE is_default = true;

-- 4. 预置飞扬默认商务条款模板（幂等：先删再插）
DELETE FROM business_terms_templates WHERE name = '默认模板' AND is_default = true;

INSERT INTO business_terms_templates (name, is_default, snapshot) VALUES (
  '默认模板',
  true,
  '{
    "source_lang": "zh",
    "schema_version": "1.0",
    "blocks": [
      {
        "key": "included",
        "enabled": true,
        "sort_order": 10,
        "type": "rich_text",
        "title": { "zh": "费用包含", "en": "Included", "sr": "Uključeno" },
        "content": {
          "zh": [
            "报价范围内的客户版服务执行费用",
            "报价所列全部服务项目",
            "项目执行期间的基础现场协调"
          ],
          "en": [
            "Client-facing service execution fees within the quotation scope",
            "All services listed in this quotation",
            "Basic on-site operational coordination during service delivery"
          ],
          "sr": [
            "Troškovi izvršenja usluga prema obimu ponude",
            "Sve usluge navedene u ovoj ponudi",
            "Osnovna koordinacija na terenu tokom realizacije"
          ]
        },
        "translation_status": { "en": "auto", "sr": "auto" },
        "source_hash": "0",
        "updated_at": "2026-03-20T00:00:00Z"
      },
      {
        "key": "excluded",
        "enabled": true,
        "sort_order": 20,
        "type": "rich_text",
        "title": { "zh": "费用不含", "en": "Excluded", "sr": "Isključeno" },
        "content": {
          "zh": [
            "国际机票、签证、个人消费及未列明第三方费用",
            "超时、临时新增服务或客户临时变更造成的追加成本"
          ],
          "en": [
            "International flights, visas, personal expenses, and unlisted third-party charges",
            "Additional costs due to overtime, ad-hoc services, or last-minute client changes"
          ],
          "sr": [
            "Međunarodne avionske karte, vize, lični troškovi i nenavedeni troškovi",
            "Dodatni troškovi zbog prekovremenog rada ili izmena na zahtev klijenta"
          ]
        },
        "translation_status": { "en": "auto", "sr": "auto" },
        "source_hash": "0",
        "updated_at": "2026-03-20T00:00:00Z"
      },
      {
        "key": "validity",
        "enabled": true,
        "sort_order": 30,
        "type": "structured",
        "title": { "zh": "报价有效期", "en": "Quotation Validity", "sr": "Rok važenja ponude" },
        "fields": {
          "validity_mode": "days",
          "valid_days": 10,
          "valid_until": null,
          "validity_note": null
        }
      },
      {
        "key": "payment",
        "enabled": true,
        "sort_order": 40,
        "type": "structured",
        "title": { "zh": "付款方式与节点", "en": "Payment Terms", "sr": "Uslovi plaćanja" },
        "fields": {
          "payment_methods": ["bank_transfer"],
          "other_payment_method_text": null,
          "deposit_percent": 50,
          "balance_due_days_before_event": 7,
          "payment_note": null
        }
      },
      {
        "key": "notes",
        "enabled": true,
        "sort_order": 50,
        "type": "rich_text",
        "title": { "zh": "特别说明", "en": "Special Notes", "sr": "Posebne napomene" },
        "content": {
          "zh": "本报价自出具之日起 10 个自然日内有效，如服务范围调整，报价金额将随之更新。",
          "en": "This quotation remains valid for 10 calendar days from the issue date. Any scope adjustment may result in a revised quotation.",
          "sr": "Ova ponuda važi 10 kalendarskih dana od datuma izdavanja. Svaka promena obima može dovesti do revidirane ponude."
        },
        "translation_status": { "en": "auto", "sr": "auto" },
        "source_hash": "0",
        "updated_at": "2026-03-20T00:00:00Z"
      }
    ]
  }'::jsonb
);
