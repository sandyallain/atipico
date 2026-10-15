import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Client Supabase côté serveur (pages, server actions, route handlers). La session vit dans les cookies.
export async function supabase() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Appelé depuis un Server Component : le middleware rafraîchit la session.
          }
        },
      },
    },
  );
}

export async function currentUser() {
  const db = await supabase();
  const { data } = await db.auth.getUser();
  return { db, user: data.user };
}

/** Pour les pages et actions réservées aux membres : connecté ET profil créé. */
export async function requireMember() {
  const { db, user } = await currentUser();
  if (!user) redirect("/entrar");
  const { data: profile } = await db.from("profiles").select("id,pseudo,city").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/bienvenida");
  return { db, user, profile };
}
