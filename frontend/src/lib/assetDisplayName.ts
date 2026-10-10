export function assetDisplayName(asset: { name: string; category?: string | null; bankName?: string | null }) {
  if (asset.category === "bank" && asset.bankName) {
    return `${asset.bankName} – ${asset.name}`;
  }
  return asset.name;
}
