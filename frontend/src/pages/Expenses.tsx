import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Ban, RotateCcw } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Expense as ExpenseEntry, Asset } from "../types";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { MonthPicker } from "../components/ui/MonthPicker";
import { ExpenseForm } from "../components/forms/ExpenseForm";
import type { ExpenseInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";
import { expenseLabel } from "../lib/expenseLabels";
import { frequencyLabel } from "../lib/frequencyLabels";
import { scheduleLabel } from "../lib/recurring";
import { assetDisplayName } from "../lib/assetDisplayName";
import { ExpenseCharts } from "../components/charts/ExpenseCharts";

export function Expenses() {
  const { list, create, update, remove } = useResource<ExpenseEntry>("expenses");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [terminating, setTerminating] = useState<ExpenseEntry | null>(null);
  const [reactivating, setReactivating] = useState<ExpenseEntry | null>(null);
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

  const monthOf = (d: string) => String(d).slice(0, 7);

  const recurringEntries = useMemo(
    () => (list.data ?? []).filter(
      (e) => e.frequency !== "one_time" && monthOf(e.date) <= selectedMonth && !e.terminatedAt
    ),
    [list.data, selectedMonth]
  );

  const terminatedEntries = useMemo(
    () => (list.data ?? []).filter(
      (e) => e.frequency !== "one_time" && monthOf(e.date) <= selectedMonth && !!e.terminatedAt
    ),
    [list.data, selectedMonth]
  );

  const oneTimeEntries = useMemo(
    () => (list.data ?? []).filter(
      (e) => e.frequency === "one_time" && monthOf(e.date) === selectedMonth
    ),
    [list.data, selectedMonth]
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of list.data ?? []) set.add(Number(String(e.date).slice(0, 4)));
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [list.data]);

  async function handleSubmit(data: ExpenseInput) {
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload: data });
    } else {
      await create.mutateAsync(data);
    }
    setShowForm(false);
    setEditing(null);
  }

  function openEdit(entry: ExpenseEntry) {
    setEditing(entry);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setEditing(null);
  }

  function handleTerminate(entry: ExpenseEntry) {
    setTerminating(entry);
  }

  function confirmTerminate() {
    if (!terminating) return;
    update.mutate({ id: terminating.id, payload: { terminatedAt: new Date().toISOString() } });
    setTerminating(null);
  }

  function handleReactivate(entry: ExpenseEntry) {
    setReactivating(entry);
  }

  function confirmReactivate() {
    if (!reactivating) return;
    update.mutate({ id: reactivating.id, payload: { terminatedAt: null } });
    setReactivating(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Expenses</h1>
          <p className="text-sm text-slate-400">Where your money goes.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add expense
        </button>
      </div>

      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} years={years} />

      {list.data && list.data.length > 0 && (
        <ExpenseCharts entries={list.data} monthKey={selectedMonth} onMonthClick={setSelectedMonth} />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          {(recurringEntries.length > 0 || terminatedEntries.length > 0) && (
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td colSpan={6} className="bg-slate-800/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Recurring
                </td>
              </tr>
              {recurringEntries.map((entry) => (
                <tr key={entry.id} className="text-slate-200">
                  <td className="px-4 py-3">{expenseLabel(entry.category)}</td>
                  <td className="px-4 py-3 text-slate-400">{entry.merchant || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {frequencyLabel(entry.frequency ?? "one_time")}
                    <span className="text-slate-500"> · {scheduleLabel(entry.frequency, entry.dayOfPeriod)}</span>
                  </td>
                  <td className="px-4 py-3 text-rose-400">
                    -{format(entry.amount, entry.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {entry.assetId ? (assetMap.get(entry.assetId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleTerminate(entry)} title="Terminate" className="text-slate-500 hover:text-amber-400 mr-2">
                      <Ban size={16} />
                    </button>
                    <button onClick={() => openEdit(entry)} className="text-slate-500 hover:text-emerald-400 mr-2">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove.mutate(entry.id)} className="text-slate-500 hover:text-rose-400">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {terminatedEntries.map((entry) => (
                <tr key={entry.id} className="text-slate-200 opacity-60">
                  <td className="px-4 py-3">{expenseLabel(entry.category)}</td>
                  <td className="px-4 py-3 text-slate-400">{entry.merchant || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {frequencyLabel(entry.frequency ?? "one_time")}
                    <span className="text-slate-500"> · {scheduleLabel(entry.frequency, entry.dayOfPeriod)}</span>
                    <span className="ml-2 rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Terminated
                    </span>
                  </td>
                  <td className="px-4 py-3 text-rose-400">
                    -{format(entry.amount, entry.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {entry.assetId ? (assetMap.get(entry.assetId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleReactivate(entry)} title="Reactivate" className="text-slate-500 hover:text-emerald-400 mr-2">
                      <RotateCcw size={16} />
                    </button>
                    <button onClick={() => openEdit(entry)} className="text-slate-500 hover:text-emerald-400 mr-2">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove.mutate(entry.id)} className="text-slate-500 hover:text-rose-400">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td colSpan={6} className="bg-slate-800/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                One-time — {new Date(selectedMonth + "-01").toLocaleString(undefined, { month: "long", year: "numeric" })}
              </td>
            </tr>
            {oneTimeEntries.map((entry) => (
              <tr key={entry.id} className="text-slate-200">
                <td className="px-4 py-3">{expenseLabel(entry.category)}</td>
                <td className="px-4 py-3 text-slate-400">{entry.merchant || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{frequencyLabel(entry.frequency ?? "one_time")}</td>
                <td className="px-4 py-3 text-rose-400">
                  -{format(entry.amount, entry.currency)}
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
            {oneTimeEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No one-time expenses for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit expense" : "Add expense"} onClose={closeModal}>
          <ExpenseForm
            onSubmit={handleSubmit}
            isSubmitting={create.isPending || update.isPending}
            isEditing={!!editing}
            displayCurrency={displayCurrency}
            defaultValues={editing ? {
              category: editing.category,
              merchant: editing.merchant,
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

      <ConfirmDialog
        open={!!terminating}
        title="Terminate recurring expense"
        message={`Stop "${terminating?.merchant ?? terminating?.category}" from repeating? Its history will remain.`}
        confirmLabel="Terminate"
        onConfirm={confirmTerminate}
        onCancel={() => setTerminating(null)}
      />

      <ConfirmDialog
        open={!!reactivating}
        title="Reactivate recurring expense"
        message={`Resume "${reactivating?.merchant ?? reactivating?.category}" as a recurring expense?`}
        confirmLabel="Reactivate"
        onConfirm={confirmReactivate}
        onCancel={() => setReactivating(null)}
      />
    </div>
  );
}
