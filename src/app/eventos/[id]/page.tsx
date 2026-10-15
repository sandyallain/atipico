import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser, requireMember } from "@/lib/supabase";
import { AmbianceChip } from "@/components/event";
import { formatDay } from "@/lib/time";

// S14 : détail d'un événement, s'inscrire / se désinscrire.
async function join(form: FormData) {
  "use server";
  const id = String(form.get("id"));
  const { db } = await requireMember();
  const { error } = await db.rpc("join_event", { e: id });
  if (error) redirect(`/eventos/${id}?error=join`);
  revalidatePath(`/eventos/${id}`);
}

async function leave(form: FormData) {
  "use server";
  const id = String(form.get("id"));
  const { db } = await requireMember();
  await db.rpc("leave_event", { e: id });
  revalidatePath(`/eventos/${id}`);
}

export default async function Evento({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db, user } = await currentUser();
  const { data: e } = await db.from("events").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();

  // Les inscriptions ne sont lisibles que par les membres (RLS) : sans compte, liste vide.
  const { data: parts } = await db.from("participations")
    .select("profile_id,status,profiles(pseudo)").eq("event_id", id).order("created_at");
  const going = (parts ?? []).filter((p) => p.status === "going");
  const waiting = (parts ?? []).filter((p) => p.status === "waitlist");
  const mine = user ? (parts ?? []).find((p) => p.profile_id === user.id)?.status : undefined;
  const d = formatDay(e.start_at);
  const past = new Date(e.start_at) < new Date();
  const full = e.capacity != null && going.length >= e.capacity;
  const closed = e.status !== "open" || past;

  return (
    <article className="mx-auto grid max-w-2xl gap-6">
      <Link href="/" className="text-sm text-muted hover:text-text">← Todos los planes</Link>
      <header className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <AmbianceChip level={e.ambiance} />
          {e.status === "cancelled" && <span className="chip bg-lively-soft text-lively">Cancelado</span>}
          {past && e.status === "open" && <span className="chip bg-surface-2 text-muted">Ya pasó</span>}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-balance break-words">{e.title}</h1>
        <p className="text-lg first-letter:uppercase">{d.full}</p>
        <p className="text-muted">{e.address ?? "Online"} · {e.city}</p>
      </header>

      <section className="card grid gap-3 p-5" aria-live="polite">
        {error === "join" && <p role="alert" className="text-sm text-danger">No hemos podido apuntarte. Puede que el plan esté cerrado.</p>}
        <p className="text-sm text-muted tabular-nums">
          {user ? `${going.length}${e.capacity ? ` de ${e.capacity}` : ""} personas van` : "Entra para ver quién va."}
          {waiting.length > 0 && ` · ${waiting.length} en lista de espera`}
        </p>
        {!user ? (
          <Link href="/entrar" className="btn btn-primary justify-self-start">Entrar para apuntarme</Link>
        ) : mine === "going" || mine === "waitlist" ? (
          <form action={leave} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={id} />
            <span className="font-bold">{mine === "going" ? "Vas a este plan." : "Estás en la lista de espera. Te avisaremos si queda una plaza."}</span>
            {!closed && <button className="btn btn-danger">{mine === "going" ? "Ya no puedo ir" : "Salir de la lista"}</button>}
          </form>
        ) : closed ? (
          <p className="font-bold">Este plan ya no admite inscripciones.</p>
        ) : (
          <form action={join}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-primary">{full ? "Apuntarme a la lista de espera" : "Me apunto"}</button>
          </form>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Qué vamos a hacer</h2>
        <p className="max-w-[65ch] whitespace-pre-line break-words">{e.description}</p>
      </section>

      {user && going.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Van</h2>
          <ul className="flex flex-wrap gap-2">
            {going.map((p) => (
              <li key={p.profile_id} className="chip bg-surface-2 text-text">
                {(p.profiles as unknown as { pseudo: string } | null)?.pseudo ?? "—"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
