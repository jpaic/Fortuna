-- Helper script: Run once then delete
-- Each successful BTC purchase as separate entry

-- !! SET YOUR USER ID HERE !!
-- Find it with: SELECT id FROM users LIMIT 1;

INSERT INTO investments (user_id, asset_name, ticker, type, quantity, average_buy_price, current_price, broker, currency, purchase_date) VALUES
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00020333, 96395.02, 0, NULL, 'EUR', '2025-11-01'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00042274, 81137.34, 0, NULL, 'EUR', '2025-12-04'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00056298, 80073.89, 0, NULL, 'EUR', '2025-12-08'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00044875, 78618.38, 0, NULL, 'EUR', '2025-12-09'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00086672, 73841.61, 0, NULL, 'EUR', '2025-12-18'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00066307, 75376.66, 0, NULL, 'EUR', '2025-12-24'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00411448, 60736.72, 0, NULL, 'EUR', '2026-02-16'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00172000, 55837.21, 0, NULL, 'EUR', '2026-06-18'),
('YOUR_USER_ID_HERE', 'Bitcoin', 'BTC', 'crypto', 0.00055000, 53454.55, 0, NULL, 'EUR', '2026-06-24');

-- After running, refresh prices to get current_price populated:
-- POST /api/prices/refresh
