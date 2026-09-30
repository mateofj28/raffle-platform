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
function nowInBogota(): { date: string; hour: number; iso: string } {
    // en-CA => YYYY-MM-DD; hour12:false => hora 00-23.
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
    // Intl puede devolver "24" a medianoche en algunos entornos; se normaliza a 0.
    let hour = parseInt(get("hour"), 10);
    if (Number.isNaN(hour)) hour = 0;
    if (hour === 24) hour = 0;
    // Marca "local Bogotá" comparable como string: "YYYY-MM-DDTHH:mm".
    const iso = `${date}T${String(hour).padStart(2, "0")}:${get("minute")}`;
    return { date, hour, iso };
}

/** Campos de bloqueo que puede tener una rifa. */
export interface RaffleLockFields {
    endDate?: string | null;
    drawDate?: string | null;
    /** Cierre manual del admin (interruptor). true = cerrada de inmediato. */
    manualClosed?: boolean | null;
    /** Cierre programado: fecha/hora local Bogotá "YYYY-MM-DDTHH:mm". Al llegar, cierra. */
    closeAt?: string | null;
}

/**
 * ¿La rifa está cerrada (no se permiten operaciones)? Considera, en orden:
 *  1. Cierre MANUAL del admin (manualClosed === true) → cerrada ya.
 *  2. Cierre PROGRAMADO (closeAt): si ahora (Bogotá) ya alcanzó esa fecha/hora.
 *  3. Respaldo por SORTEO: el día de endDate a partir de las 20:00, o días después.
 * `endDate` es "YYYY-MM-DD".
 */
export function isRaffleClosed(fields: RaffleLockFields): boolean {
    // 1) Cierre manual inmediato.
    if (fields.manualClosed === true) return true;

    const { date, hour, iso } = nowInBogota();

    // 2) Cierre programado a fecha/hora.
    if (fields.closeAt) {
        // closeAt esperado como "YYYY-MM-DDTHH:mm" (hora Bogotá). Comparación de
        // strings ISO local es cronológicamente correcta con mismo formato.
        const target = fields.closeAt.length >= 16 ? fields.closeAt.slice(0, 16) : fields.closeAt;
        if (iso >= target) return true;
    }

    // 3) Respaldo por el día del sorteo.
    const endDate = fields.endDate ?? fields.drawDate;
    if (endDate) {
        const day = endDate.slice(0, 10);
        if (date > day) return true;
        if (date === day && hour >= CUTOFF_HOUR_BOGOTA) return true;
    }

    return false;
}

/**
 * Compat: ¿bloqueada solo por el sorteo? (se conserva la firma antigua).
 */
export function isRaffleDrawLocked(endDate?: string | null): boolean {
    return isRaffleClosed({ endDate });
}

/**
 * Lanza AppError si la rifa está cerrada (manual, programada o por sorteo).
 * Se usa en toda operación de escritura sobre boletas/pagos.
 */
export function assertRaffleNotClosed(fields: RaffleLockFields): void {
    if (isRaffleClosed(fields)) {
        throw new AppError(
            AppErrorCode.INVALID_TRANSITION,
            "La rifa está cerrada. Un administrador debe reabrirla para permitir operaciones."
        );
    }
}

/** Compat con la firma anterior (solo endDate). */
export function assertRaffleNotDrawLocked(endDate?: string | null): void {
    assertRaffleNotClosed({ endDate });
}

/**
 * Lee la rifa por id y lanza AppError si está cerrada (manual/programada/sorteo).
 * Útil en operaciones que no tienen ya cargados los campos de la rifa.
 */
export async function assertRaffleNotLockedById(tenantId: string, raffleId: string): Promise<void> {
    const snap = await getDb().doc(`tenants/${tenantId}/raffles/${raffleId}`).get();
    if (!snap.exists) return; // si no existe, otras validaciones lo manejan
    const d = snap.data() ?? {};
    assertRaffleNotClosed({
        endDate: d.endDate ?? d.drawDate,
        drawDate: d.drawDate,
        manualClosed: d.manualClosed,
        closeAt: d.closeAt,
    });
}
