const EXPENSE_LABELS: Record<string, string> = {
  rent: "Rent", mortgage: "Mortgage", utilities: "Utilities", home_reno: "Home improvement",
  home_ins: "Home insurance", hoa: "HOA / Maintenance", groceries: "Groceries",
  dining_out: "Dining out", coffee: "Coffee", fuel: "Fuel", car_ins: "Car insurance",
  car_maint: "Car maintenance", parking: "Parking", transit: "Public transit",
  ride_share: "Ride share / Taxi", clothing: "Clothing", grooming: "Personal care",
  fitness: "Fitness / Gym", subs_stream: "Streaming", subs_software: "Software / Apps",
  subs_gaming: "Gaming", news: "News / Magazines", doctors: "Doctors / Visits",
  pharmacy: "Pharmacy", dental: "Dental", vision: "Vision", tuition: "Tuition",
  books: "Books / Supplies", courses: "Courses / Training", kids: "Childcare / Kids",
  eldercare: "Eldercare", pets: "Pets", travel: "Travel", gifts: "Gifts",
  donations: "Donations", fees: "Bank fees", taxes: "Taxes", insurance: "Insurance (other)",
  interest: "Interest paid", stocks: "Stock purchase", etf_inv: "ETF purchase",
  crypto_inv: "Crypto purchase", bonds: "Bond purchase", other: "Other",
};

export function expenseLabel(key: string): string {
  return EXPENSE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}
