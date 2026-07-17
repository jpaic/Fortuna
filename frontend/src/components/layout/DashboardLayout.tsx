import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  LineChart,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../context/CurrencyContext";
import { CURRENCIES } from "../../lib/currencies";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/assets", label: "Assets", icon: Wallet },
  { to: "/investments", label: "Investments", icon: LineChart },
  { to: "/income", label: "Income", icon: ArrowUpCircle },
  { to: "/expenses", label: "Expenses", icon: ArrowDownCircle },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { displayCurrency, setDisplayCurrency, loading: ratesLoading } = useCurrency();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold tracking-tight text-white">Fortuna</p>
          <p className="text-xs text-slate-500">Personal finance</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-slate-800 pt-4">
          <div className="px-2">
            <label className="mb-1 block text-xs text-slate-500">Display currency</label>
            <div className="relative">
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                disabled={ratesLoading}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 pr-8 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {ratesLoading && (
                <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-emerald-400" />
              )}
            </div>
          </div>
          <p className="truncate px-3 text-sm text-slate-300">
            {user?.firstName} {user?.lastName}
          </p>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
