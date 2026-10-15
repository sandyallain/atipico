import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";

export const metadata = { title: "Entrar" };

// S02 : connexion sans mot de passe (lien magique). Le même formulaire sert à créer un compte.
async function sendLink(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/entrar?error=email");
  const origin = (await headers()).get("origin");
  const db = await supabase();
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  redirect(error ? "/entrar?error=send" : "/entrar?enviado=1");
}

const ERRORS: Record<string, string> = {
  email: "Revisa el correo: falta algo (por ejemplo la @).",
  send: "No hemos podido enviar el enlace. Espera un minuto y vuelve a intentarlo.",
  link: "El enlace ha caducado o ya se usó. Pide uno nuevo.",
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ enviado?: string; error?: string }> }) {
  const { enviado, error } = await searchParams;
  return (
    <div className="mx-auto grid max-w-md gap-5">
      <h1 className="text-3xl font-extrabold tracking-tight">Entrar</h1>
      {enviado ? (
        <div className="card grid gap-2 p-5" role="status">
          <p className="font-bold">Te hemos enviado un enlace.</p>
          <p className="text-muted">Abre tu correo y pulsa el enlace para entrar. Si no aparece, mira en spam.</p>
        </div>
      ) : (
        <form action={sendLink} className="card grid gap-4 p-5">
          <p className="text-muted">Sin contraseña: te enviamos un enlace por correo. Si es tu primera vez, se crea tu cuenta.</p>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" aria-describedby={error ? "err" : undefined} />
            {error && <span id="err" className="text-xs text-danger">{ERRORS[error] ?? ERRORS.send}</span>}
          </div>
          <button className="btn btn-primary">Enviar enlace</button>
        </form>
      )}
    </div>
  );
}
