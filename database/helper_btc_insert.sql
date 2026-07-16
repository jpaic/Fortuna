-- Helper script: Run once then delete
-- One aggregated BTC investment + value history for progression chart

-- !! SET YOUR USER ID HERE !!
-- Find it with: SELECT id FROM users LIMIT 1;

-- Step 1: Create the investment (run, note the ID, then use below)
-- SELECT id FROM investments LIMIT 1; -- to see format

-- Step 2: Insert aggregated BTC investment
-- After running, note the returned id and replace INVESTMENT_ID below
INSERT INTO investments (user_id, asset_name, ticker, type, quantity, average_buy_price, current_price, broker, currency, purchase_date)
VALUES (
  'YOUR_USER_ID_HERE',
  'Bitcoin',
  'BTC',
  'crypto',
  0.00955207,           -- total BTC
  66614.53,             -- avg buy price EUR
  0,                    -- updated by price refresh
  NULL,
  'EUR',
  '2025-11-01'          -- earliest purchase
)
RETURNING id;

-- Step 3: Insert value history using the id from above
-- Replace INVESTMENT_ID with the actual UUID returned

INSERT INTO investment_value_history (investment_id, user_id, value, recorded_date) VALUES
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 19.60, '2025-11-01'),   -- 0.00020333 * 96395.02
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 54.38, '2025-12-04'),   -- +0.00042274 * 81137.34
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 99.46, '2025-12-08'),   -- +0.00056298 * 80073.89
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 134.73, '2025-12-09'),  -- +0.00044875 * 78618.38
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 198.75, '2025-12-18'),  -- +0.00086672 * 73841.61
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 249.68, '2025-12-24'),  -- +0.00066307 * 75376.66
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 499.68, '2026-02-16'),  -- +0.00411448 * 60736.72
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 595.58, '2026-06-18'),  -- +0.00172 * 55837.21
-- ('INVESTMENT_ID', 'YOUR_USER_ID_HERE', 625.00, '2026-06-24');  -- +0.00055 * 53454.55
;

-- After running, refresh prices:
-- POST /api/prices/refresh
