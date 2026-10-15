import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EventCard, type EventRow } from "@/components/event";

// S13 : liste des événements à venir, filtrée par ville.
export default async function Home({ searchParams }: { searchParams: Promise<{ ciudad?: string }> }) {
  const { ciudad } = await searchParams;
  const db = await supabase();
  let q = db.from("events")
    .select("id,title,city,address,start_at,capacity,ambiance,status")
    .eq("status", "open").gte("start_at", new Date().toISOString())
    .order("start_at").limit(50);
  if (ciudad) q = q.ilike("city", ciudad);
  const { data, error } = await q;
  const events = (data ?? []) as EventRow[];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">Planes tranquilos, gente como tú</h1>
        <p className="max-w-[60ch] text-muted">Quedadas para personas neurodivergentes. Antes de apuntarte sabes cómo será: ruido, tamaño del grupo, ritmo.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="field min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" name="ciudad" defaultValue={ciudad} placeholder="Madrid" className="input" />
        </div>
        <button className="btn btn-secondary">Buscar</button>
      </form>

      {error ? (
        <p role="alert" className="card p-4 text-danger">No hemos podido cargar los planes. Recarga la página en un momento.</p>
      ) : events.length === 0 ? (
        <div className="card grid justify-items-start gap-3 p-6">
          <p>{ciudad ? `Aún no hay planes en ${ciudad}.` : "Aún no hay planes."} Crea el primero.</p>
          <Link href="/eventos/nuevo" className="btn btn-primary">Crear plan</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => <li key={e.id}><EventCard e={e} /></li>)}
        </ul>
      )}
    </div>
  );
}
