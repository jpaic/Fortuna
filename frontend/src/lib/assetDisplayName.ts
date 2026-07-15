export function assetDisplayName(asset: { name: string; category?: string; bankName?: string }) {
  if (asset.category === "bank" && asset.bankName) {
    return `${asset.bankName} – ${asset.name}`;
  }
  return asset.name;
}
