import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  LineChart,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/assets", label: "Assets", icon: Wallet },
  { to: "/investments", label: "Investments", icon: LineChart },
  { to: "/income", label: "Income", icon: ArrowUpCircle },
  { to: "/expenses", label: "Expenses", icon: ArrowDownCircle },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold tracking-tight text-white">Ledger</p>
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

        <div className="border-t border-slate-800 pt-4">
          <p className="truncate px-3 text-sm text-slate-300">
            {user?.firstName} {user?.lastName}
          </p>
          <button
            onClick={() => logout()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
