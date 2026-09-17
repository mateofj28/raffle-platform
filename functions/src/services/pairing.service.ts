/**
 * Pairing Service - Parejas de números para rifas de 2 números.
 *
 * En una rifa de 2 números, cada boleta física juega DOS números de lotería
 * (una pareja arbitraria, p. ej. [1282, 8888]). Las parejas se definen UNA sola
 * vez a nivel del tenant y se reutilizan en todas las rifas de 2 números futuras.
 *
 * Provee:
 * - savePairings: guarda/valida las 5.000 parejas (cubren 0000..9999 sin repetir).
 * - getPairings:  devuelve las parejas guardadas del tenant (o null si no hay).
 *
 * Almacenamiento: tenants/{tenantId}/config/pairings  (documento único).
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { AppError, AppErrorCode, handleError } from "../utils/errors";
import { getDb } from "../utils/firestore";

const TOTAL_NUMBERS = 10000; // 0000..9999
const EXPECTED_PAIRS = TOTAL_NUMBERS / 2; // 5000

const savePairingsSchema = z.object({
    // Lista de parejas [n1, n2], cada número en 0..9999.
    pairs: z.array(
        z.tuple([
            z.number().int().min(0).max(9999),
            z.number().int().min(0).max(9999),
        ])
    ),
});

/** Doc de configuración de parejas del tenant. */
function pairingsRef(tenantId: string) {
    return getDb().doc(`tenants/${tenantId}/config/pairings`);
}

/**
 * Guarda las parejas del tenant tras validar que:
 *  - hay exactamente 5.000 parejas,
 *  - cubren todos los números 0000..9999 exactamente una vez (sin repetir ni faltar),
 *  - ningún par empareja un número consigo mismo.
 * Admin-only. Si ya existían parejas, las reemplaza (definición única, editable).
 */
export const savePairings = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const { pairs } = validateData(savePairingsSchema, request.data);

            if (pairs.length !== EXPECTED_PAIRS) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    `Debes definir exactamente ${EXPECTED_PAIRS} parejas (van ${pairs.length}).`
                );
            }

            // Validar cobertura completa y sin repetidos de 0000..9999.
            const seen = new Set<number>();
            for (const [a, b] of pairs) {
                if (a === b) {
                    throw new AppError(AppErrorCode.VALIDATION_ERROR, `El número ${a} no puede emparejarse consigo mismo.`);
                }
                if (seen.has(a)) {
                    throw new AppError(AppErrorCode.CONFLICT, `El número ${String(a).padStart(4, "0")} está repetido en las parejas.`);
                }
                if (seen.has(b)) {
                    throw new AppError(AppErrorCode.CONFLICT, `El número ${String(b).padStart(4, "0")} está repetido en las parejas.`);
                }
                seen.add(a);
                seen.add(b);
            }
            if (seen.size !== TOTAL_NUMBERS) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    `Faltan números por emparejar. Deben estar los ${TOTAL_NUMBERS} números (0000–9999).`
                );
            }

            // Firestore NO permite arrays anidados (array de tuplas). Se guarda
            // cada pareja como objeto { a, b }. La interfaz pública sigue usando
            // tuplas [a, b]; la conversión es interna (aquí y en readPairings).
            const storedPairs = pairs.map(([a, b]) => ({ a, b }));

            await pairingsRef(context.tenantId).set({
                pairs: storedPairs,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: context.uid,
            });

            return { success: true, pairs: pairs.length };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Devuelve las parejas guardadas del tenant, o { pairs: null } si aún no existen.
 * Admin o cajero pueden leerlas (las necesitan al crear/gestionar rifas).
 */
export const getPairings = onCall(
    { region: "us-central1", timeoutSeconds: 60 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            // Cualquier usuario autenticado del tenant puede leerlas.
            const snap = await pairingsRef(context.tenantId).get();
            if (!snap.exists) return { pairs: null };
            return { pairs: decodePairs(snap.data()?.pairs) };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Convierte las parejas almacenadas a tuplas [a, b].
 * Soporta el formato actual (objetos { a, b }) y, por retrocompatibilidad, el
 * formato antiguo de tuplas [a, b] por si quedara algún dato anterior.
 */
function decodePairs(raw: unknown): [number, number][] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map((item) => {
        if (Array.isArray(item)) return [item[0], item[1]] as [number, number];
        const obj = item as { a: number; b: number };
        return [obj.a, obj.b] as [number, number];
    });
}

/** Helper interno: devuelve las parejas del tenant o null. */
export async function readPairings(tenantId: string): Promise<[number, number][] | null> {
    const snap = await pairingsRef(tenantId).get();
    if (!snap.exists) return null;
    return decodePairs(snap.data()?.pairs);
}
