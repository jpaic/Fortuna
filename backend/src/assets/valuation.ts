import { query } from "../db/pool.js";
import { upsertAssetHistory } from "./helpers.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";

interface AssetRow {
  id: string;
  user_id: string;
  category: string;
  purchase_value: string;
  purchase_date: string;
  mileage_km: number | null;
  location: string | null;
  valuation_method: string;
  estimated_at: string | null;
}

// ── Vehicle depreciation curve ──────────────────────────────────────────────
// Industry-standard used-car depreciation: steep first years, flattening later.
const VEHICLE_DEPRECIATION = [
  0.18, // year 1:  -18%
  0.15, // year 2:  -15%
  0.12, // year 3:  -12%
  0.10, // year 4:  -10%
  0.08, // year 5+: -8% per year
];

const MAX_DEPRECIATION = 0.85; // cap: never below 15% of purchase
const EXPECTED_ANNUAL_KM = 15_000;
const EXCESS_KM_PENALTY = 0.02; // +2% depreciation per 20 000 km over expected
const EXCESS_KM_STEP = 20_000;
const MAX_EXCESS_PENALTY = 0.15;

export function estimateVehicle(
  purchaseValue: number,
  purchaseDate: Date,
  mileageKm: number | null,
): number {
  const now = new Date();
  const yearsOwned =
    (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (yearsOwned <= 0) return purchaseValue;

  let depreciation = 0;
  const fullYears = Math.floor(yearsOwned);
  for (let i = 0; i < fullYears; i++) {
    depreciation += VEHICLE_DEPRECIATION[Math.min(i, 4)];
  }
  // Partial current year
  const partial = yearsOwned - fullYears;
  depreciation += VEHICLE_DEPRECIATION[Math.min(fullYears, 4)] * partial;

  // Mileage penalty
  if (mileageKm != null && mileageKm > 0) {
    const expected = EXPECTED_ANNUAL_KM * yearsOwned;
    const excess = Math.max(0, mileageKm - expected);
    const penalty = Math.min(MAX_EXCESS_PENALTY, (excess / EXCESS_KM_STEP) * EXCESS_KM_PENALTY);
    depreciation += penalty;
  }

  depreciation = Math.min(depreciation, MAX_DEPRECIATION);
  return Math.round(purchaseValue * (1 - depreciation) * 100) / 100;
}

// ── Real-estate appreciation ────────────────────────────────────────────────
// Regional annual appreciation rates. Beograd appreciates fastest.
const RE_APPRECIATION: Record<string, number> = {
  beograd: 0.04,
  novi_sad: 0.035,
  other: 0.03,
};

export function estimateRealEstate(
  purchaseValue: number,
  purchaseDate: Date,
  location: string | null,
): number {
  const now = new Date();
  const yearsOwned =
    (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (yearsOwned <= 0) return purchaseValue;

  const rate = RE_APPRECIATION[location ?? "other"] ?? 0.03;
  return Math.round(purchaseValue * Math.pow(1 + rate, yearsOwned) * 100) / 100;
}

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  const s = String(val);
  return new Date(s.length <= 10 ? s + "T00:00:00" : s);
}

function estimateFromRow(row: AssetRow): number | null {
  if (row.category !== "vehicle" && row.category !== "real_estate") return null;
  const purchaseValue = Number(row.purchase_value);
  if (purchaseValue <= 0) return null;
  const purchaseDate = toDate(row.purchase_date);
  if (isNaN(purchaseDate.getTime())) return null;

  return row.category === "vehicle"
    ? estimateVehicle(purchaseValue, purchaseDate, row.mileage_km)
    : estimateRealEstate(purchaseValue, purchaseDate, row.location);
}

// ── Revalue a single asset (on create / edit) ───────────────────────────────
// Returns the estimated value, or null if the asset isn't auto-valuable.
export async function revalueAsset(
  userId: string,
  assetId: string,
): Promise<number | null> {
  const rows = await query<AssetRow>(
    `SELECT id, user_id, category, purchase_value, purchase_date,
            mileage_km, location, valuation_method, estimated_at
     FROM assets WHERE id = $1 AND user_id = $2`,
    [assetId, userId],
  );
  const asset = rows[0];
  if (!asset || asset.valuation_method !== "auto") return null;

  const estimated = estimateFromRow(asset);
  if (estimated == null) return null;

  await query(
    `UPDATE assets SET current_value = $1, estimated_at = now() WHERE id = $2`,
    [estimated, assetId],
  );
  await upsertAssetHistory(userId, { id: assetId, current_value: estimated });
  await upsertDailySnapshot(userId);
  return estimated;
}

// ── Quarterly gate ──────────────────────────────────────────────────────────
function shouldRefresh(asset: AssetRow, now: Date): boolean {
  if (!asset.estimated_at) return true;
  const last = new Date(asset.estimated_at);
  const daysSince = (now.getTime() - last.getTime()) / (24 * 3600 * 1000);
  return daysSince >= 85; // ~quarterly
}

// ── Bulk refresh (cron) ─────────────────────────────────────────────────────
export async function refreshUserAssetValuations(
  userId: string,
): Promise<{ updated: number; skipped: number }> {
  const assets = await query<AssetRow>(
    `SELECT id, user_id, category, purchase_value, purchase_date,
            mileage_km, location, valuation_method, estimated_at
     FROM assets
     WHERE user_id = $1
       AND category IN ('vehicle', 'real_estate')
       AND valuation_method = 'auto'`,
    [userId],
  );

  const now = new Date();
  let updated = 0;
  let skipped = 0;

  for (const asset of assets) {
    if (!shouldRefresh(asset, now)) {
      skipped++;
      continue;
    }

    const estimated = estimateFromRow(asset);
    if (estimated == null) {
      skipped++;
      continue;
    }

    await query(
      `UPDATE assets SET current_value = $1, estimated_at = now() WHERE id = $2`,
      [estimated, asset.id],
    );
    await upsertAssetHistory(userId, { id: asset.id, current_value: estimated });
    updated++;
  }

  if (updated > 0) {
    await upsertDailySnapshot(userId);
  }

  return { updated, skipped };
}
