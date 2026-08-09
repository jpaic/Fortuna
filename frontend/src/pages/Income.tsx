import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Income as IncomeEntry, Asset } from "../types";
import { Modal } from "../components/ui/Modal";
import { MonthPicker } from "../components/ui/MonthPicker";
import { IncomeForm } from "../components/forms/IncomeForm";
import type { IncomeInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";
import { incomeLabel } from "../lib/incomeLabels";
import { frequencyLabel } from "../lib/frequencyLabels";
import { scheduleLabel } from "../lib/recurring";
import { assetDisplayName } from "../lib/assetDisplayName";
import { IncomeCharts } from "../components/charts/IncomeCharts";

export function Income() {
  const { list, create, update, remove } = useResource<IncomeEntry>("income");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IncomeEntry | null>(null);
  const { format, displayCurrency } = useCurrency();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const assetMap = new Map(assets?.map((a) => [a.id, assetDisplayName(a)]) ?? []);

  const filteredEntries = useMemo(
    () => (list.data ?? []).filter((e) => String(e.date).slice(0, 7) === selectedMonth),
    [list.data, selectedMonth]
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of list.data ?? []) set.add(Number(String(e.date).slice(0, 4)));
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [list.data]);

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
          <p className="text-sm text-slate-400">Where your money comes from.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add income
        </button>
      </div>

      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} years={years} />

      {list.data && list.data.length > 0 && (
        <IncomeCharts entries={list.data} monthKey={selectedMonth} onMonthClick={setSelectedMonth} />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="text-slate-200">
                <td className="px-4 py-3">{entry.source}</td>
                <td className="px-4 py-3 text-slate-400">{incomeLabel(entry.category)}</td>
                <td className="px-4 py-3 text-slate-400">
                  {frequencyLabel(entry.frequency)}
                  {entry.frequency !== "one_time" && (
                    <span className="text-slate-500"> · {scheduleLabel(entry.frequency, entry.dayOfPeriod)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-emerald-400">
                  +{format(entry.amount, entry.currency)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {entry.assetId ? (assetMap.get(entry.assetId) ?? "—") : "—"}
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
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No income recorded for this month.
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
            isEditing={!!editing}
            displayCurrency={displayCurrency}
            defaultValues={editing ? {
              source: editing.source,
              category: editing.category,
              amount: editing.amount,
              currency: editing.currency,
              frequency: editing.frequency,
              dayOfPeriod: editing.dayOfPeriod,
              date: editing.date,
              notes: editing.notes,
              assetId: editing.assetId,
            } : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
