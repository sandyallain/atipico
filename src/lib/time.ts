// Heures : stockées en UTC, saisies et affichées à l'heure de Madrid.
// ponytail: un seul fuseau (Europe/Madrid). Ajouter le fuseau de la ville quand on ouvre les Canaries.
export const TZ = "Europe/Madrid";

function offsetAt(utcMs: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(utcMs).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}

/** "2026-10-18T11:00" (valeur d'un <input type="datetime-local">, heure de Madrid) -> ISO UTC. */
export function madridToUtc(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("bad_date");
  const naive = Date.parse(local + ":00Z");
  let t = naive - offsetAt(naive);
  t = naive - offsetAt(t); // corrige autour du changement d'heure
  return new Date(t).toISOString();
}

export function formatDay(iso: string) {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat("es-ES", { timeZone: TZ, month: "short" }).format(d).replace(".", ""),
    full: new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d),
    short: new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d),
  };
}
