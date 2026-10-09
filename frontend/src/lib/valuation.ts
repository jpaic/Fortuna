// Client-side mirrors of backend/src/assets/valuation.ts (for live form preview).
// Keep the constants in sync with the backend.

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// Saturating retention table (age -> fraction of new price). Keep in sync with
// backend/src/assets/valuation.ts. Non-exponential so manufacture year matters.
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
const EXCESS_KM_PENALTY = 0.02;
const EXCESS_KM_STEP = 20_000;
const MAX_EXCESS_PENALTY = 0.15;

export const RE_APPRECIATION: Record<string, number> = {
  beograd: 0.04,
  novi_sad: 0.035,
  other: 0.03,
};

export const RE_LOCATION_LABELS: Record<string, string> = {
  beograd: "Beograd",
  novi_sad: "Novi Sad",
  other: "Other / Ostalo",
};

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

function toMs(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

export function estimateVehicleValue(
  purchaseValue: number,
  purchaseDate: string,
  mileageKm?: number | null,
  manufactureYear?: number | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const boughtMs = toMs(purchaseDate);
  if (isNaN(boughtMs)) return purchaseValue;

  const hasYear = manufactureYear != null && manufactureYear > 1900;
  const madeMs = hasYear ? Date.UTC(manufactureYear as number, 0, 1) : null;

  const nowMs = Date.now();
  const ageNow = hasYear ? (nowMs - (madeMs as number)) / YEAR_MS : (nowMs - boughtMs) / YEAR_MS;
  const ageAtPurchase = hasYear ? Math.max(0, (boughtMs - (madeMs as number)) / YEAR_MS) : 0;

  if (ageNow <= 0) return purchaseValue;

  let value = purchaseValue * (vehicleRetention(ageNow) / vehicleRetention(ageAtPurchase));

  if (mileageKm != null && mileageKm > 0) {
    const expected = EXPECTED_ANNUAL_KM * ageNow;
    const excess = Math.max(0, mileageKm - expected);
    value *= 1 - Math.min(MAX_EXCESS_PENALTY, (excess / EXCESS_KM_STEP) * EXCESS_KM_PENALTY);
  }

  return Math.round(Math.max(0, value) * 100) / 100;
}

export function estimateRealEstateValue(
  purchaseValue: number,
  purchaseDate: string,
  location?: string | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const boughtMs = toMs(purchaseDate);
  if (isNaN(boughtMs)) return purchaseValue;
  const yearsOwned = (Date.now() - boughtMs) / YEAR_MS;
  if (yearsOwned <= 0) return purchaseValue;
  const rate = RE_APPRECIATION[location ?? "other"] ?? 0.03;
  return Math.round(purchaseValue * Math.pow(1 + rate, yearsOwned) * 100) / 100;
}

export function isAutoValuable(category: string): boolean {
  return category === "vehicle" || category === "real_estate";
}
