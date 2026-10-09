// Client-side mirrors of backend/src/assets/valuation.ts (for live form preview).
// Keep the constants in sync with the backend.

const VEHICLE_DEPRECIATION = [0.18, 0.15, 0.12, 0.1, 0.08];
const MAX_DEPRECIATION = 0.85;
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

function yearsSince(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return 0;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function estimateVehicleValue(
  purchaseValue: number,
  purchaseDate: string,
  mileageKm?: number | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const yearsOwned = yearsSince(purchaseDate);
  if (yearsOwned <= 0) return purchaseValue;

  let depreciation = 0;
  const fullYears = Math.floor(yearsOwned);
  for (let i = 0; i < fullYears; i++) {
    depreciation += VEHICLE_DEPRECIATION[Math.min(i, 4)];
  }
  depreciation += VEHICLE_DEPRECIATION[Math.min(fullYears, 4)] * (yearsOwned - fullYears);

  if (mileageKm != null && mileageKm > 0) {
    const expected = EXPECTED_ANNUAL_KM * yearsOwned;
    const excess = Math.max(0, mileageKm - expected);
    depreciation += Math.min(MAX_EXCESS_PENALTY, (excess / EXCESS_KM_STEP) * EXCESS_KM_PENALTY);
  }

  depreciation = Math.min(depreciation, MAX_DEPRECIATION);
  return Math.round(purchaseValue * (1 - depreciation) * 100) / 100;
}

export function estimateRealEstateValue(
  purchaseValue: number,
  purchaseDate: string,
  location?: string | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const yearsOwned = yearsSince(purchaseDate);
  if (yearsOwned <= 0) return purchaseValue;
  const rate = RE_APPRECIATION[location ?? "other"] ?? 0.03;
  return Math.round(purchaseValue * Math.pow(1 + rate, yearsOwned) * 100) / 100;
}

export function isAutoValuable(category: string): boolean {
  return category === "vehicle" || category === "real_estate";
}
