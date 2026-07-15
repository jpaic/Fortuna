-- 017_add_bank_name_to_assets.sql
-- Store the bank name for bank-category assets (e.g. "Chase", "Revolut").

ALTER TABLE assets ADD COLUMN bank_name VARCHAR(255);
