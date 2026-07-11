import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useResource } from "../hooks/useResource";
import type { Asset } from "../types";
import { Modal } from "../components/ui/Modal";
import { AssetForm } from "../components/forms/AssetForm";
import type { AssetInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";

export function Assets() {
  const { list, create, update, remove } = useResource<Asset>("assets");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const { format, displayCurrency } = useCurrency();

  async function handleSubmit(data: AssetInput) {
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload: data });
    } else {
      await create.mutateAsync(data);
    }
    setShowForm(false);
    setEditing(null);
  }

  function openEdit(asset: Asset) {
    setEditing(asset);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Assets</h1>
          <p className="text-sm text-slate-400">Everything you own.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add asset
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Current value</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {list.data?.map((asset) => (
              <tr key={asset.id} className="text-slate-200">
                <td className="px-4 py-3">{asset.name}</td>
                <td className="px-4 py-3 capitalize text-slate-400">
                  {asset.category.replace("_", " ")}
                </td>
                <td className="px-4 py-3">{format(asset.purchaseValue, asset.currency)}</td>
                <td className="px-4 py-3">{format(asset.currentValue, asset.currency)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(asset)} className="text-slate-500 hover:text-emerald-400 mr-2">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove.mutate(asset.id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No assets yet. Add your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit asset" : "Add asset"} onClose={closeModal}>
          <AssetForm
            onSubmit={handleSubmit}
            isSubmitting={create.isPending || update.isPending}
            displayCurrency={displayCurrency}
            defaultValues={editing ? {
              name: editing.name,
              category: editing.category,
              purchaseValue: editing.purchaseValue,
              currentValue: editing.currentValue,
              currency: editing.currency,
              purchaseDate: editing.purchaseDate,
              notes: editing.notes,
            } : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
