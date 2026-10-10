// Client-side mirrors of backend/src/assets/valuation.ts (for live form preview).
// Keep the constants in sync with the backend.

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// Fraction of the *purchase price* still retained after N years of ownership.
// Strictly non-increasing, so holding a car longer can only ever lower the
// estimate. Keep in sync with backend/src/assets/valuation.ts.
//
// This replaces an earlier ratio model (R(ageNow) / R(ageAtPurchase)) anchored
// on the car's manufacture year. That formulation could not express "older car
// is worth less": for f(a) = R(a+c)/R(a) to decrease with age, the decay rate
// -R'(a)/R(a) must increase with age, but real depreciation curves flatten. The
// ratio therefore rose as cars got older, so entering an earlier manufacture
// year increased the estimate. Anchoring on time owned removes manufacture year
// from the value; it is still stored and displayed, it just no longer moves the
// number.
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

function toMs(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

export function estimateVehicleValue(
  purchaseValue: number,
  purchaseDate: string,
  mileageKm?: number | null,
  mileageAtPurchaseKm?: number | null,
): number {
  if (purchaseValue <= 0) return purchaseValue;
  const boughtMs = toMs(purchaseDate);
  if (isNaN(boughtMs)) return purchaseValue;

  const yearsOwned = (Date.now() - boughtMs) / YEAR_MS;
  if (yearsOwned <= 0) return purchaseValue;

  let value = purchaseValue * ownershipRetention(yearsOwned);

  // Only the distance driven since purchase counts against you. Both readings
  // are required: without the purchase odometer the current reading cannot be
  // split into "mine" and "previous owner's", so the adjustment is skipped.
  if (mileageKm != null && mileageAtPurchaseKm != null) {
    const driven = Math.max(0, mileageKm - mileageAtPurchaseKm);
    const expected = EXPECTED_ANNUAL_KM * yearsOwned;
    const excess = Math.max(0, driven - expected);
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
