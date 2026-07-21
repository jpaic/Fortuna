import { Loader2 } from "lucide-react";

export function LoadingSpinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-emerald-500 ${className}`} />;
}

export function PageLoader({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
      <LoadingSpinner size={28} />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

export function FullScreenLoader({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950">
      <LoadingSpinner size={32} />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
