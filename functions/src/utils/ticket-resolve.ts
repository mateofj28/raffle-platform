/**
 * Resolución "número de lotería → boleta".
 *
 * En rifas de 1 número el docId de la boleta ES el número (4 dígitos), así que
 * resolver es directo. En rifas de 2 números, cada boleta juega una PAREJA
 * arbitraria `numbers: [a, b]` y su docId es min(a,b); por eso, buscar por el
 * segundo número no coincide con el docId. Este helper resuelve cualquiera de
 * los dos números de la pareja a su documento real usando el índice
 * `numbers array-contains`.
 *
 * Devuelve la referencia del documento (o null si ningún ticket contiene ese
 * número). El llamador decide cómo leer/escribir (fuera o dentro de transacción).
 */

import type { DocumentReference } from "firebase-admin/firestore";
import { getDb } from "./firestore";

function padTicketNumber(num: number): string {
    return String(num).padStart(4, "0");
}

/**
 * Resuelve el DocumentReference de la boleta que contiene `num` en la rifa.
 * Estrategia:
 *  1. Intenta el acceso directo por docId = padTicketNumber(num). Esto cubre
 *     rifas de 1 número y, en las de 2, cuando num es el menor de su pareja.
 *  2. Si ese documento no existe (o no contiene el número), busca por
 *     `numbers array-contains num` (cubre el segundo número de la pareja).
 * Retorna null si ningún documento contiene el número.
 */
export async function resolveTicketRef(
    tenantId: string,
    raffleId: string,
    num: number
): Promise<DocumentReference | null> {
    const db = getDb();
    const ticketsCol = db.collection(`tenants/${tenantId}/raffles/${raffleId}/tickets`);

    // 1) Acceso directo por docId (rápido, sin índice).
    const directRef = ticketsCol.doc(padTicketNumber(num));
    const directSnap = await directRef.get();
    if (directSnap.exists) {
        const data = directSnap.data()!;
        const numbers: number[] = Array.isArray(data.numbers) ? data.numbers : [data.number];
        if (numbers.includes(num)) return directRef;
    }

    // 2) Búsqueda por el array de números (segundo número de la pareja).
    const q = await ticketsCol.where("numbers", "array-contains", num).limit(1).get();
    if (!q.empty) return q.docs[0].ref;

    return null;
}

/**
 * Resuelve varios números a sus DocumentReference únicos.
 * Devuelve un mapa num→ref (los números que no existen se omiten) y además la
 * lista de refs deduplicadas (dos números de la misma pareja resuelven al mismo
 * documento, así que no se procesa dos veces la misma boleta).
 */
export async function resolveTicketRefs(
    tenantId: string,
    raffleId: string,
    nums: number[]
): Promise<{ byNumber: Map<number, DocumentReference>; refs: DocumentReference[] }> {
    const byNumber = new Map<number, DocumentReference>();
    const seenPaths = new Set<string>();
    const refs: DocumentReference[] = [];

    for (const num of nums) {
        const ref = await resolveTicketRef(tenantId, raffleId, num);
        if (!ref) continue;
        byNumber.set(num, ref);
        if (!seenPaths.has(ref.path)) {
            seenPaths.add(ref.path);
            refs.push(ref);
        }
    }

    return { byNumber, refs };
}
