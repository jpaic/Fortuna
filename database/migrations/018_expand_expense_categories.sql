-- 018_expand_expense_categories.sql
-- Expand expense categories from 7 flat values to 30+ subcategories
-- grouped under logical parents. Existing rows keep their old values.

ALTER TABLE expenses
  ALTER COLUMN category TYPE VARCHAR(50);

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    -- Housing
    'rent', 'mortgage', 'utilities', 'home_reno', 'home_ins', 'hoa',
    -- Food
    'groceries', 'dining_out', 'coffee',
    -- Transport
    'fuel', 'car_ins', 'car_maint', 'parking', 'transit', 'ride_share',
    -- Personal
    'clothing', 'grooming', 'fitness',
    -- Subscriptions
    'subs_stream', 'subs_software', 'subs_gaming', 'news',
    -- Health
    'doctors', 'pharmacy', 'dental', 'vision',
    -- Education
    'tuition', 'books', 'courses',
    -- Family
    'kids', 'eldercare',
    -- Pets
    'pets',
    -- Travel
    'travel',
    -- Gifts
    'gifts', 'donations',
    -- Financial
    'fees', 'taxes', 'insurance', 'interest',
    'stocks', 'crypto_inv', 'etf_inv', 'bonds',
    -- Other
    'other'
  ));
