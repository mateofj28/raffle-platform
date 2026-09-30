/**
 * Bloqueo/cierre de la rifa (versión front, solo para MOSTRAR y deshabilitar).
 *
 * Una rifa está CERRADA (no se permiten operaciones) si:
 *   1. El admin la cerró manualmente (manualClosed === true), o
 *   2. Llegó la fecha/hora programada de cierre (closeAt, hora Colombia), o
 *   3. (Respaldo) es el día del sorteo (endDate) a partir de las 20:00, o después.
 *
 * La garantía real está en el backend; esto solo sirve para avisar al usuario
 * y deshabilitar botones.
 */

const CUTOFF_HOUR_BOGOTA = 20;

function nowInBogota(): { date: string; hour: number; iso: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    let hour = parseInt(get("hour"), 10);
    if (Number.isNaN(hour)) hour = 0;
    if (hour === 24) hour = 0;
    const iso = `${date}T${String(hour).padStart(2, "0")}:${get("minute")}`;
    return { date, hour, iso };
}

export interface RaffleLockFields {
    endDate?: string | null;
    drawDate?: string | null;
    manualClosed?: boolean | null;
    closeAt?: string | null;
}

/** Motivo del cierre, para mostrar mensajes específicos. */
export type RaffleCloseReason = "manual" | "scheduled" | "draw" | null;

/** ¿La rifa está cerrada? Devuelve true/false. */
export function isRaffleClosed(fields: RaffleLockFields): boolean {
    return getRaffleCloseReason(fields) !== null;
}

/** Devuelve el motivo por el que la rifa está cerrada (o null si está abierta). */
export function getRaffleCloseReason(fields: RaffleLockFields): RaffleCloseReason {
    if (fields.manualClosed === true) return "manual";

    const { date, hour, iso } = nowInBogota();

    if (fields.closeAt) {
        const target = fields.closeAt.length >= 16 ? fields.closeAt.slice(0, 16) : fields.closeAt;
        if (iso >= target) return "scheduled";
    }

    const endDate = fields.endDate ?? fields.drawDate;
    if (endDate) {
        const day = endDate.slice(0, 10);
        if (date > day) return "draw";
        if (date === day && hour >= CUTOFF_HOUR_BOGOTA) return "draw";
    }

    return null;
}

/**
 * Compat: ¿bloqueada por el sorteo? Acepta el endDate directamente (firma antigua)
 * o un objeto con los campos de cierre.
 */
export function isRaffleDrawLocked(endDateOrFields?: string | null | RaffleLockFields): boolean {
    if (endDateOrFields == null) return false;
    if (typeof endDateOrFields === "string") return isRaffleClosed({ endDate: endDateOrFields });
    return isRaffleClosed(endDateOrFields);
}
