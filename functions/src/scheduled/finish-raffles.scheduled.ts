/**
 * Finish Raffles Scheduled Function.
 *
 * Corre diariamente y marca como "finished" toda rifa "active" cuyo día de
 * sorteo (drawDate) ya terminó por completo. El corte es al FINAL del día del
 * sorteo: una rifa con sorteo el 30 de enero se finaliza cuando ya es 31 o más
 * (según la zona horaria de Colombia).
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { getDb } from "../utils/firestore";

/**
 * Devuelve la fecha de "hoy" en Colombia como string YYYY-MM-DD.
 * drawDate se guarda en ese mismo formato (solo fecha), así que la
 * comparación de strings YYYY-MM-DD es cronológicamente correcta.
 */
function todayInBogota(): string {
    // en-CA produce el formato YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

export const finishExpiredRaffles = onSchedule(
    { schedule: "every 24 hours", timeZone: "America/Bogota", region: "us-central1" },
    async () => {
        const db = getDb();
        const today = todayInBogota();
        let finished = 0;
        let errors = 0;

        // Recorre todos los tenants y sus rifas activas. Cada tenant y cada rifa
        // se procesan de forma aislada: un fallo puntual (permiso, red, doc
        // corrupto) se registra pero NO aborta el resto del ciclo.
        const tenants = await db.collection("tenants").get();
        for (const tenant of tenants.docs) {
            try {
                const activeRaffles = await tenant.ref
                    .collection("raffles")
                    .where("status", "==", "active")
                    .get();

                for (const raffle of activeRaffles.docs) {
                    try {
                        const drawDate: string | undefined = raffle.data().drawDate;
                        if (!drawDate) continue;

                        // Corte al final del día del sorteo: finaliza solo cuando HOY
                        // es estrictamente posterior a la fecha de sorteo.
                        if (today > drawDate) {
                            await raffle.ref.update({
                                status: "finished",
                                updatedAt: FieldValue.serverTimestamp(),
                            });
                            finished++;
                        }
                    } catch (raffleErr) {
                        errors++;
                        logger.error(
                            `finishExpiredRaffles: error al finalizar rifa ${raffle.ref.path}`,
                            raffleErr
                        );
                    }
                }
            } catch (tenantErr) {
                errors++;
                logger.error(
                    `finishExpiredRaffles: error al procesar tenant ${tenant.id}`,
                    tenantErr
                );
            }
        }

        logger.info(
            `finishExpiredRaffles: ${finished} rifa(s) finalizada(s), ${errors} error(es). Fecha ${today}`
        );
    }
);
