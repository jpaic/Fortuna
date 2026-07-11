import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useResource } from "../hooks/useResource";
import type { Income as IncomeEntry } from "../types";
import { Modal } from "../components/ui/Modal";
import { IncomeForm } from "../components/forms/IncomeForm";
import type { IncomeInput } from "../lib/schemas";

export function Income() {
  const { list, create, remove } = useResource<IncomeEntry>("income");
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(data: IncomeInput) {
    await create.mutateAsync(data);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Income</h1>
          <p className="text-sm text-slate-400">Money coming in.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
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
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {list.data?.map((entry) => (
              <tr key={entry.id} className="text-slate-200">
                <td className="px-4 py-3">{entry.source}</td>
                <td className="px-4 py-3 capitalize text-slate-400">{entry.category}</td>
                <td className="px-4 py-3 capitalize text-slate-400">
                  {entry.frequency.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-emerald-400">
                  +{entry.currency} {entry.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-400">{entry.date}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove.mutate(entry.id)}
                    className="text-slate-500 hover:text-rose-400"
                  >
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
        <Modal title="Add income" onClose={() => setShowForm(false)}>
          <IncomeForm onSubmit={handleCreate} isSubmitting={create.isPending} />
        </Modal>
      )}
    </div>
  );
}
