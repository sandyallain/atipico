import { redirect } from "next/navigation";
import { requireMember } from "@/lib/supabase";
import { madridToUtc } from "@/lib/time";

export const metadata = { title: "Crear plan" };

// S15 : créer un événement.
async function createEvent(form: FormData) {
  "use server";
  const { db, user } = await requireMember();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const online = form.get("online") === "on";
  let start: string;
  try { start = madridToUtc(s("start_at")); } catch { redirect("/eventos/nuevo?error=date"); }
  if (new Date(start) < new Date()) redirect("/eventos/nuevo?error=past");
  const capacity = s("capacity") ? Number(s("capacity")) : null;

  const { data, error } = await db.from("events").insert({
    creator_id: user.id,
    title: s("title"),
    description: s("description"),
    city: s("city"),
    address: online ? null : s("address") || null,
    start_at: start,
    capacity,
    ambiance: Number(s("ambiance")) || 2,
  }).select("id").single();
  if (error || !data) redirect("/eventos/nuevo?error=save");
  await db.rpc("join_event", { e: data.id }); // l'organisateur·rice est inscrit·e d'office
  redirect(`/eventos/${data.id}`);
}

const ERRORS: Record<string, string> = {
  date: "Revisa la fecha y la hora.",
  past: "La fecha ya ha pasado. Elige una fecha futura.",
  save: "No hemos podido crear el plan. Revisa que el título tenga al menos 5 caracteres e inténtalo de nuevo.",
};

export default async function Nuevo({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { profile } = await requireMember();
  const { error } = await searchParams;
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <h1 className="text-3xl font-extrabold tracking-tight">Crear un plan</h1>
      {error && <p role="alert" className="card border-danger p-4 text-danger">{ERRORS[error] ?? ERRORS.save}</p>}
      <form action={createEvent} className="card grid gap-4 p-5">
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" name="title" required minLength={5} maxLength={120} className="input" placeholder="Paseo lento por El Retiro" />
        </div>
        <div className="field">
          <label htmlFor="description">Qué vamos a hacer</label>
          <textarea id="description" name="description" required maxLength={4000} rows={5} className="input py-2.5" placeholder="Punto de encuentro, ritmo, qué traer, si se puede ir y venir…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="start_at">Fecha y hora</label>
            <input id="start_at" name="start_at" type="datetime-local" required className="input" />
            <span className="hint">Hora de Madrid.</span>
          </div>
          <div className="field">
            <label htmlFor="capacity">Plazas (opcional)</label>
            <input id="capacity" name="capacity" type="number" min={2} max={500} className="input" placeholder="8" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="city">Ciudad</label>
            <input id="city" name="city" required defaultValue={profile.city} className="input" />
          </div>
          <div className="field">
            <label htmlFor="address">Lugar</label>
            <input id="address" name="address" className="input" placeholder="Puerta de Alcalá" />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="online" className="size-5 accent-[var(--accent)]" /> Es online
        </label>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">Ambiente</legend>
          {[
            [1, "Tranquilo", "Poco ruido, grupo pequeño, sin presión para hablar."],
            [2, "Moderado", "Algo de conversación y movimiento."],
            [3, "Animado", "Música, gente, energía."],
          ].map(([v, label, help]) => (
            <label key={v} className="flex items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="ambiance" value={v} defaultChecked={v === 1} className="mt-1 accent-[var(--accent)]" />
              <span><b>{label}</b> · <span className="text-muted">{help}</span></span>
            </label>
          ))}
        </fieldset>
        <button className="btn btn-primary">Publicar plan</button>
      </form>
    </div>
  );
}
