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
  mileage_at_purchase_km: number | null;
  fuel_type: string | null;
  manufacture_year: number | null;
  location: string | null;
  valuation_method: string;
  estimated_at: string | null;
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// ── Vehicle depreciation ─────────────────────────────────────────────────────
// Fraction of the *purchase price* still retained after N years of ownership.
// Strictly non-increasing, so holding a car longer can only ever lower the
// estimate.
//
// This replaces an earlier ratio model (R(ageNow) / R(ageAtPurchase)) that was
// anchored on the car's manufacture year. That formulation could not express
// "older car is worth less": for f(a) = R(a+c)/R(a) to decrease with age, the
// instantaneous decay rate -R'(a)/R(a) must *increase* with age, but real
// depreciation curves flatten out. The ratio therefore rose as cars got older,
// so entering an earlier manufacture year increased the estimate. Anchoring on
// time owned removes manufacture year from the value entirely; it is still
// stored and displayed, it just no longer moves the number.
const OWNERSHIP_RETENTION: [number, number][] = [
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

// ── Powertrain ───────────────────────────────────────────────────────────────
// Retained value differs by powertrain. Autovista / JD Power residual-value
// readings for 3-year-old European cars (60,000 km), averaged across the
// published months:
//
//   petrol 50.5%   hybrid 51.1%   diesel 49.8%   PHEV 44.9%   BEV 38.2%
//
// Expressed as a scaling of *time held* rather than a multiplier on the
// result: each factor is the number of equivalent years that reproduces that
// powertrain's residual on our retention curve, so the gap widens the longer
// the car is kept. A level multiplier would apply once and then flat-line,
// which is the opposite of how the BEV/PHEV gap behaves.
//
// No level premium is applied for the powertrain. It is already inside the
// price the user paid, so adding it again would double-count it.
//
// LPG has no comparable published residual series; its factor is a judgement
// call rather than a measurement.
const FUEL_TIME_FACTOR: Record<string, number> = {
  petrol: 1.0,
  diesel: 1.04,
  hybrid: 0.97,
  phev: 1.33,
  electric: 1.81,
  lpg: 1.15,
};

function ownershipRetention(yearsOwned: number): number {
  if (yearsOwned <= 0) return 1;
  const last = OWNERSHIP_RETENTION[OWNERSHIP_RETENTION.length - 1];
  if (yearsOwned >= last[0]) return last[1];
  for (let i = 0; i < OWNERSHIP_RETENTION.length - 1; i++) {
    const [y0, r0] = OWNERSHIP_RETENTION[i];
    const [y1, r1] = OWNERSHIP_RETENTION[i + 1];
    if (yearsOwned >= y0 && yearsOwned <= y1) {
      const t = (yearsOwned - y0) / (y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return last[1];
}

export function estimateVehicle(
  purchaseValue: number,
  purchaseDate: Date,
  mileageKm: number | null,
  mileageAtPurchaseKm: number | null,
  fuelType: string | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const boughtMs = purchaseDate.getTime();
  if (isNaN(boughtMs)) return purchaseValue;

  const yearsOwned = (Date.now() - boughtMs) / YEAR_MS;
  if (yearsOwned <= 0) return purchaseValue;

  // An unknown or unrecognised powertrain falls back to 1.0, which leaves the
  // estimate exactly as it was before fuel types were recorded.
  const fuelFactor = (fuelType && FUEL_TIME_FACTOR[fuelType]) || 1.0;

  let value = purchaseValue * ownershipRetention(yearsOwned * fuelFactor);

  // Only the distance driven since purchase counts against you. Both readings
  // are required: without the purchase odometer we cannot tell how much of the
  // current reading is yours, so the adjustment is skipped rather than guessed.
  if (mileageKm != null && mileageAtPurchaseKm != null) {
    const driven = Math.max(0, mileageKm - mileageAtPurchaseKm);
    const expected = EXPECTED_ANNUAL_KM * yearsOwned;
    const excess = Math.max(0, driven - expected);
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
    ? estimateVehicle(purchaseValue, purchaseDate, row.mileage_km, row.mileage_at_purchase_km, row.fuel_type)
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
            mileage_km, mileage_at_purchase_km, fuel_type,
            manufacture_year, location,
            valuation_method, estimated_at
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
            mileage_km, mileage_at_purchase_km, fuel_type,
            manufacture_year, location,
            valuation_method, estimated_at
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
