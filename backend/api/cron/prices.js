export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Import compiled modules
  const { query } = await import("../../dist/db/pool.js");
  const { refreshUserPrices } = await import("../../dist/prices/service.js");

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

  return res.json({ refreshed, failed, users: users.length });
}
