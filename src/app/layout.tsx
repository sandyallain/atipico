import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Atípico", template: "%s · Atípico" },
  description: "Planes tranquilos y gente como tú. Eventos y encuentros para personas neurodivergentes en España.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await currentUser();
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3">Ir al contenido</a>
        <header className="border-b border-border bg-surface">
          <nav className="wrap flex h-16 items-center gap-5" aria-label="Principal">
            <Link href="/" className="text-xl font-extrabold tracking-tight">At<span className="text-accent">í</span>pico</Link>
            <Link href="/" className="text-sm font-bold text-muted hover:text-text">Eventos</Link>
            <span className="flex-1" />
            {user ? (
              <>
                <Link href="/eventos/nuevo" className="btn btn-primary">Crear plan</Link>
                <form action="/salir" method="post"><button className="text-sm text-muted hover:text-text">Salir</button></form>
              </>
            ) : (
              <Link href="/entrar" className="btn btn-secondary">Entrar</Link>
            )}
          </nav>
        </header>
        <main id="main" className="wrap py-8">{children}</main>
        <footer className="wrap pb-10 text-center text-xs text-muted">Atípico es gratis y sin anuncios.</footer>
      </body>
    </html>
  );
}
