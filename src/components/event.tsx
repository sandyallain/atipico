import Link from "next/link";
import { formatDay } from "@/lib/time";

export type EventRow = {
  id: string; title: string; city: string; address: string | null;
  start_at: string; capacity: number | null; ambiance: number; status: string;
};

const AMBIANCE = {
  1: { label: "Tranquilo", cls: "bg-calm-soft text-calm", icon: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6" },
  2: { label: "Moderado", cls: "bg-medium-soft text-medium", icon: "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" },
  3: { label: "Animado", cls: "bg-lively-soft text-lively", icon: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" },
} as const;

export function AmbianceChip({ level }: { level: number }) {
  const a = AMBIANCE[level as 1 | 2 | 3] ?? AMBIANCE[2];
  return (
    <span className={`chip ${a.cls}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={a.icon} /></svg>
      {a.label}
    </span>
  );
}

export function EventCard({ e }: { e: EventRow }) {
  const d = formatDay(e.start_at);
  return (
    <Link href={`/eventos/${e.id}`} className={`card grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 p-3.5 hover:border-border-input ${e.status === "cancelled" ? "opacity-70" : ""}`}>
      <div className="rounded-md bg-surface-2 py-1.5 text-center leading-tight" aria-label={d.full}>
        <b className="block text-2xl font-extrabold tabular-nums">{d.day}</b>
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{d.month}</span>
      </div>
      <div className="min-w-0">
        <h3 className={`text-base font-bold leading-snug break-words ${e.status === "cancelled" ? "line-through" : ""}`}>{e.title}</h3>
        <p className="text-sm text-muted">{d.short} · {e.address ?? "Online"} · {e.city}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <AmbianceChip level={e.ambiance} />
          {e.status === "cancelled" ? "Cancelado" : e.capacity ? `Máx. ${e.capacity} personas` : null}
        </div>
      </div>
    </Link>
  );
}
