import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useResource } from "../hooks/useResource";
import type { Expense as ExpenseEntry } from "../types";
import { Modal } from "../components/ui/Modal";
import { ExpenseForm } from "../components/forms/ExpenseForm";
import type { ExpenseInput } from "../lib/schemas";

export function Expenses() {
  const { list, create, remove } = useResource<ExpenseEntry>("expenses");
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(data: ExpenseInput) {
    await create.mutateAsync(data);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Expenses</h1>
          <p className="text-sm text-slate-400">Where your money goes.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add expense
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {list.data?.map((entry) => (
              <tr key={entry.id} className="text-slate-200">
                <td className="px-4 py-3 capitalize">{entry.category}</td>
                <td className="px-4 py-3 text-slate-400">{entry.merchant || "—"}</td>
                <td className="px-4 py-3 text-rose-400">
                  -{entry.currency} {entry.amount.toLocaleString()}
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
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Add expense" onClose={() => setShowForm(false)}>
          <ExpenseForm onSubmit={handleCreate} isSubmitting={create.isPending} />
        </Modal>
      )}
    </div>
  );
}
