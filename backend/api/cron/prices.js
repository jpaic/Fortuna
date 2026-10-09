export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { query } = await import("../../dist/db/pool.js");
  const { refreshUserPrices } = await import("../../dist/prices/service.js");
  const { processRecurring } = await import("../../dist/recurring/processor.js");
  const { refreshUserAssetValuations } = await import("../../dist/assets/valuation.js");

  // Refresh investment prices
  const users = await query("SELECT DISTINCT user_id FROM investments WHERE ticker IS NOT NULL AND ticker != ''");
  let refreshed = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await refreshUserPrices(user.user_id);
      refreshed += result.updated;
      failed += result.failed;
    } catch {
      failed++;
    }
  }

  // Refresh auto-estimated asset valuations (vehicles / real estate, ~quarterly)
  const valUsers = await query(
    "SELECT DISTINCT user_id FROM assets WHERE category IN ('vehicle','real_estate') AND valuation_method = 'auto'"
  );
  let valuations = 0;
  for (const user of valUsers) {
    try {
      const result = await refreshUserAssetValuations(user.user_id);
      valuations += result.updated;
    } catch {
      // valuation failure shouldn't block price refresh
    }
  }

  // Process recurring expenses/income
  let recurring = { expensesProcessed: 0, incomeProcessed: 0 };
  try {
    recurring = await processRecurring();
  } catch {
    // Recurring processing failure shouldn't block price refresh
  }

  return res.json({ refreshed, failed, users: users.length, valuations, ...recurring });
}
