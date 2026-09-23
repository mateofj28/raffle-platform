/**
 * Bloqueo por transparencia el día del sorteo (versión front, solo para MOSTRAR).
 *
 * El sorteo es el día de `endDate` (YYYY-MM-DD). A partir de las 20:00 hora de
 * Colombia (America/Bogota) de ese día, la rifa queda bloqueada: no se permiten
 * operaciones de escritura. La garantía real está en el backend; esto solo sirve
 * para avisar al usuario y deshabilitar botones.
 */

const CUTOFF_HOUR_BOGOTA = 20;

function nowInBogota(): { date: string; hour: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    let hour = parseInt(get("hour"), 10);
    if (Number.isNaN(hour)) hour = 0;
    if (hour === 24) hour = 0;
    return { date, hour };
}

/** ¿La rifa está bloqueada por el sorteo? `endDate` es "YYYY-MM-DD". */
export function isRaffleDrawLocked(endDate?: string | null): boolean {
    if (!endDate) return false;
    // endDate puede venir como ISO ("2026-09-20T...") o "YYYY-MM-DD"; tomar la fecha.
    const day = endDate.slice(0, 10);
    const { date, hour } = nowInBogota();
    if (date > day) return true;
    if (date === day && hour >= CUTOFF_HOUR_BOGOTA) return true;
    return false;
}
