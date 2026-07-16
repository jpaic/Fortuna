import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useResource } from "../hooks/useResource";
import type { Income as IncomeEntry } from "../types";
import { Modal } from "../components/ui/Modal";
import { IncomeForm } from "../components/forms/IncomeForm";
import type { IncomeInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";
import { incomeLabel } from "../lib/incomeLabels";

export function Income() {
  const { list, create, update, remove } = useResource<IncomeEntry>("income");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IncomeEntry | null>(null);
  const { format, displayCurrency } = useCurrency();

  async function handleSubmit(data: IncomeInput) {
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload: data });
    } else {
      await create.mutateAsync(data);
    }
    setShowForm(false);
    setEditing(null);
  }

  function openEdit(entry: IncomeEntry) {
    setEditing(entry);
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
          <h1 className="text-2xl font-semibold text-white">Income</h1>
          <p className="text-sm text-slate-400">Money coming in.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add income
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {list.data?.map((entry) => (
              <tr key={entry.id} className="text-slate-200">
                <td className="px-4 py-3">{entry.source}</td>
                <td className="px-4 py-3 text-slate-400">{incomeLabel(entry.category)}</td>
                <td className="px-4 py-3 capitalize text-slate-400">
                  {entry.frequency.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-emerald-400">
                  +{format(entry.amount, entry.currency)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {entry.notes || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(entry)} className="text-slate-500 hover:text-emerald-400 mr-2">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove.mutate(entry.id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No income recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit income" : "Add income"} onClose={closeModal}>
          <IncomeForm
            onSubmit={handleSubmit}
            isSubmitting={create.isPending || update.isPending}
            displayCurrency={displayCurrency}
            defaultValues={editing ? {
              source: editing.source,
              category: editing.category,
              amount: editing.amount,
              currency: editing.currency,
              frequency: editing.frequency,
              date: editing.date,
              notes: editing.notes,
            } : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
