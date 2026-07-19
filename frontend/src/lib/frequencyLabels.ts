const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  yearly: "Yearly",
};

export function frequencyLabel(key: string): string {
  return FREQUENCY_LABELS[key] ?? key.replace(/_/g, " ");
}
