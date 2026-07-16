-- 020_expand_income_categories.sql
-- Expand income categories from 5 to 17. Drop CHECK, map old values, widen column.

ALTER TABLE income DROP CONSTRAINT IF EXISTS income_category_check;

UPDATE income SET category = 'capital_gains' WHERE category = 'other';
UPDATE income SET category = 'rental_income' WHERE category = 'rental';

ALTER TABLE income ALTER COLUMN category TYPE VARCHAR(50);
