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
  manufacture_year: number | null;
  location: string | null;
  valuation_method: string;
  estimated_at: string | null;
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// ── Vehicle depreciation (retention of *new* price by age) ──────────────────
// Saturating table (age in years -> fraction of new price retained). Non-
// exponential on purpose so a car's manufacture year genuinely affects value.
const RETENTION_TABLE: [number, number][] = [
  [0, 1.0],
  [1, 0.82],
  [2, 0.71],
  [3, 0.62],
  [4, 0.55],
  [5, 0.49],
  [6, 0.44],
  [7, 0.4],
  [8, 0.36],
  [9, 0.33],
  [10, 0.3],
  [12, 0.25],
  [15, 0.19],
  [20, 0.12],
  [30, 0.08],
];

const EXPECTED_ANNUAL_KM = 15_000;
const EXCESS_KM_PENALTY = 0.02; // +2% per step over expected
const EXCESS_KM_STEP = 20_000;
const MAX_EXCESS_PENALTY = 0.15;

function vehicleRetention(ageYears: number): number {
  if (ageYears <= 0) return 1;
  const table = RETENTION_TABLE;
  const last = table[table.length - 1];
  if (ageYears >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [a0, r0] = table[i];
    const [a1, r1] = table[i + 1];
    if (ageYears >= a0 && ageYears <= a1) {
      const t = (ageYears - a0) / (a1 - a0);
      return r0 + (r1 - r0) * t;
    }
  }
  return last[1];
}

export function estimateVehicle(
  purchaseValue: number,
  purchaseDate: Date,
  mileageKm: number | null,
  manufactureYear: number | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const nowMs = Date.now();
  const boughtMs = purchaseDate.getTime();
  if (isNaN(boughtMs)) return purchaseValue;

  const hasYear = manufactureYear != null && manufactureYear > 1900;
  const madeMs = hasYear ? Date.UTC(manufactureYear, 0, 1) : null;

  const ageNow = hasYear
    ? (nowMs - (madeMs as number)) / YEAR_MS
    : (nowMs - boughtMs) / YEAR_MS;
  // If the car was already N years old when bought, only the depreciation
  // *since* the purchase applies to the price the user actually paid.
  const ageAtPurchase = hasYear ? Math.max(0, (boughtMs - (madeMs as number)) / YEAR_MS) : 0;

  if (ageNow <= 0) return purchaseValue;

  const ratio = vehicleRetention(ageNow) / vehicleRetention(ageAtPurchase);
  let value = purchaseValue * ratio;

  if (mileageKm != null && mileageKm > 0) {
    const expected = EXPECTED_ANNUAL_KM * ageNow;
    const excess = Math.max(0, mileageKm - expected);
    const penalty = Math.min(MAX_EXCESS_PENALTY, (excess / EXCESS_KM_STEP) * EXCESS_KM_PENALTY);
    value *= 1 - penalty;
  }

  return Math.round(Math.max(0, value) * 100) / 100;
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
  const now = Date.now();
  const yearsOwned = (now - purchaseDate.getTime()) / YEAR_MS;
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
    ? estimateVehicle(purchaseValue, purchaseDate, row.mileage_km, row.manufacture_year)
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
            mileage_km, manufacture_year, location, valuation_method, estimated_at
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
            mileage_km, manufacture_year, location, valuation_method, estimated_at
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
