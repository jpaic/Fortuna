-- 018_expand_expense_categories.sql
-- Drop old CHECK first (so UPDATEs to new category names are allowed),
-- then map old categories to new subcategories, then widen the column.

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

UPDATE expenses SET category = 'rent'        WHERE category = 'housing';
UPDATE expenses SET category = 'groceries'   WHERE category = 'food';
UPDATE expenses SET category = 'fuel'        WHERE category = 'transport';
UPDATE expenses SET category = 'subs_stream' WHERE category = 'entertainment';
UPDATE expenses SET category = 'subs_stream' WHERE category = 'subscriptions';
UPDATE expenses SET category = 'doctors'     WHERE category = 'healthcare';

ALTER TABLE expenses ALTER COLUMN category TYPE VARCHAR(50);
