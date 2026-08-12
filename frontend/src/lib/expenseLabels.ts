const EXPENSE_LABELS: Record<string, string> = {
  // Housing
  rent: "Rent",
  mortgage: "Mortgage",
  utilities: "Utilities",
  home_reno: "Home Improvement",
  home_ins: "Home Insurance",
  hoa: "HOA / Maintenance",
  // Food
  groceries: "Groceries",
  dining_out: "Dining Out",
  fast_food: "Fast Food",
  coffee: "Coffee",
  drinks: "Drinks",
  // Transport
  fuel: "Fuel",
  car_ins: "Car Insurance",
  car_maint: "Car Maintenance",
  car_registration: "Car Registration",
  parking: "Parking",
  transit: "Public Transit",
  ride_share: "Ride Share",
  // Personal
  clothing: "Clothing",
  grooming: "Personal Care",
  fitness: "Fitness / Gym",
  // Subscriptions
  subs_stream: "Streaming",
  subs_software: "Software / Apps",
  subs_gaming: "Gaming",
  news: "News / Magazines",
  // Health
  doctors: "Doctors / Visits",
  pharmacy: "Pharmacy",
  dental: "Dental",
  vision: "Vision",
  // Education
  tuition_fees: "Tuition Fees",
  books: "Books / Supplies",
  courses: "Courses / Training",
  // Family
  kids: "Childcare / Kids",
  eldercare: "Eldercare",
  // Pets
  pets: "Pets",
  // Travel
  travel: "Travel",
  // Leisure
  cinema: "Cinema",
  club: "Clubs / Nightlife",
  concerts: "Concerts / Events",
  hobbies: "Hobbies",
  sports_events: "Sports Events",
  // Gifts
  gifts: "Gifts",
  donations: "Donations",
  // Financial
  fees: "Bank Fees",
  taxes: "Taxes",
  insurance: "Insurance",
  interest: "Interest Paid",
  stocks: "Stock Purchase",
  etf_inv: "ETF Purchase",
  crypto_inv: "Crypto Purchase",
  bonds: "Bond Purchase",
  // Other
  other: "Other",
};

export function expenseLabel(key: string): string {
  return EXPENSE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}
