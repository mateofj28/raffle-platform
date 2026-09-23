/**
 * Bloqueo por transparencia el día del sorteo.
 *
 * El sorteo es el día de `endDate` (YYYY-MM-DD). A partir de las 20:00 hora de
 * Colombia (America/Bogota) de ese día, la rifa queda BLOQUEADA de forma
 * permanente: no se permiten operaciones de escritura (asignar, desasignar,
 * vender/cliente, abonar, corregir/reversar pagos). Nadie (ni admin ni cajero)
 * puede operar tras el corte.
 */

import { AppError, AppErrorCode } from "./errors";
import { getDb } from "./firestore";

/** Hora de corte del día del sorteo (24h). 20 = 8:00 pm. */
const CUTOFF_HOUR_BOGOTA = 20;

/** Partes de fecha/hora "ahora" en America/Bogota. */
function nowInBogota(): { date: string; hour: number } {
    // en-CA => YYYY-MM-DD; hour12:false => hora 00-23.
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
    // Intl puede devolver "24" a medianoche en algunos entornos; se normaliza a 0.
    let hour = parseInt(get("hour"), 10);
    if (Number.isNaN(hour)) hour = 0;
    if (hour === 24) hour = 0;
    return { date, hour };
}

/**
 * ¿La rifa está bloqueada por el sorteo? `endDate` es "YYYY-MM-DD".
 * Bloqueada si:
 *  - hoy (Bogotá) es posterior a endDate, o
 *  - hoy es el día del sorteo y ya son >= 20:00 en Bogotá.
 */
export function isRaffleDrawLocked(endDate?: string | null): boolean {
    if (!endDate) return false;
    const { date, hour } = nowInBogota();
    if (date > endDate) return true;
    if (date === endDate && hour >= CUTOFF_HOUR_BOGOTA) return true;
    return false;
}

/**
 * Lanza AppError si la rifa está bloqueada por el sorteo. Se usa en toda
 * operación de escritura sobre boletas/pagos.
 */
export function assertRaffleNotDrawLocked(endDate?: string | null): void {
    if (isRaffleDrawLocked(endDate)) {
        throw new AppError(
            AppErrorCode.INVALID_TRANSITION,
            "La rifa quedó cerrada el día del sorteo a las 8:00 p.m. Ya no se permiten operaciones."
        );
    }
}

/**
 * Lee la rifa por id y lanza AppError si está bloqueada por el sorteo.
 * Útil en operaciones que no tienen ya cargado el endDate de la rifa.
 */
export async function assertRaffleNotLockedById(tenantId: string, raffleId: string): Promise<void> {
    const snap = await getDb().doc(`tenants/${tenantId}/raffles/${raffleId}`).get();
    if (!snap.exists) return; // si no existe, otras validaciones lo manejan
    assertRaffleNotDrawLocked(snap.data()?.endDate ?? snap.data()?.drawDate);
}
