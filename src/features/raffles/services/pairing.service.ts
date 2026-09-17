import { callFunction } from "@/services/firebase-callable";

export type NumberPair = [number, number];

export const pairingService = {
    /** Guarda las 5.000 parejas del tenant (validadas en el backend). */
    save: (pairs: NumberPair[]) =>
        callFunction<{ success: boolean; pairs: number }>("savePairings", { pairs }),

    /** Obtiene las parejas guardadas del tenant, o null si aún no existen. */
    get: () => callFunction<{ pairs: NumberPair[] | null }>("getPairings", {}),
};
