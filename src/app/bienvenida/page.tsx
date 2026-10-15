import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase";

export const metadata = { title: "Bienvenida" };

// S04 : onboarding minimal. Pseudo, date de naissance (18+), ville, consentement explicite.
async function createProfile(form: FormData) {
  "use server";
  const { db, user } = await currentUser();
  if (!user) redirect("/entrar");
  const pseudo = String(form.get("pseudo") ?? "").trim();
  const birth = String(form.get("birth_date") ?? "");
  const city = String(form.get("city") ?? "").trim();
  if (form.get("consent") !== "on") redirect("/bienvenida?error=consent");
  if (!/^[\p{L}\p{N}_.-]{3,30}$/u.test(pseudo)) redirect("/bienvenida?error=pseudo");
  if (!city) redirect("/bienvenida?error=city");
  const adult = new Date(birth);
  adult.setFullYear(adult.getFullYear() + 18);
  if (Number.isNaN(adult.getTime()) || adult > new Date()) redirect("/bienvenida?error=age");

  const { error } = await db.from("profiles").insert({
    id: user.id, pseudo, birth_date: birth, city, consent_at: new Date().toISOString(),
  });
  if (error) redirect(error.code === "23505" ? "/bienvenida?error=taken" : "/bienvenida?error=save");
  redirect("/");
}

const ERRORS: Record<string, string> = {
  consent: "Necesitamos tu consentimiento para guardar tu perfil.",
  pseudo: "El nombre de usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.",
  city: "Indica tu ciudad para ver planes cerca.",
  age: "Atípico es solo para mayores de 18 años.",
  taken: "Ese nombre de usuario ya existe. Prueba otro.",
  save: "No hemos podido guardar tu perfil. Inténtalo de nuevo.",
};

export default async function Bienvenida({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { db, user } = await currentUser();
  if (!user) redirect("/entrar");
  const { data: exists } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (exists) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="mx-auto grid max-w-md gap-5">
      <div className="grid gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Bienvenida</h1>
        <p className="text-muted">Tres datos y listo. Lo demás puedes completarlo más tarde.</p>
      </div>
      {error && <p role="alert" className="card border-danger p-4 text-danger">{ERRORS[error] ?? ERRORS.save}</p>}
      <form action={createProfile} className="card grid gap-4 p-5">
        <div className="field">
          <label htmlFor="pseudo">Nombre de usuario</label>
          <input id="pseudo" name="pseudo" required minLength={3} maxLength={30} autoComplete="nickname" className="input" />
          <span className="hint">Es lo que verán los demás. No hace falta tu nombre real.</span>
        </div>
        <div className="field">
          <label htmlFor="birth_date">Fecha de nacimiento</label>
          <input id="birth_date" name="birth_date" type="date" required className="input" />
          <span className="hint">No se muestra. Solo comprobamos que eres mayor de edad.</span>
        </div>
        <div className="field">
          <label htmlFor="city">Ciudad</label>
          <input id="city" name="city" required autoComplete="address-level2" className="input" placeholder="Madrid" />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-1 size-5 accent-[var(--accent)]" />
          <span>Acepto que Atípico guarde mi perfil, que puede incluir información sobre neurodivergencia, para conectarme con otras personas. Puedo borrar mi cuenta cuando quiera.</span>
        </label>
        <button className="btn btn-primary">Crear mi perfil</button>
      </form>
    </div>
  );
}
