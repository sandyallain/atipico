import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Retour du lien magique : ouvre la session, puis onboarding si le profil n'existe pas encore.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const db = await supabase();
  const { data, error } = code ? await db.auth.exchangeCodeForSession(code) : { data: null, error: true };
  if (error || !data?.user) return NextResponse.redirect(new URL("/entrar?error=link", url.origin));
  const { data: profile } = await db.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  return NextResponse.redirect(new URL(profile ? "/" : "/bienvenida", url.origin));
}
