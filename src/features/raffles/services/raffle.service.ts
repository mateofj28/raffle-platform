import { callFunction } from "@/services/firebase-callable";
import type { Raffle, RaffleStatus } from "@/types/api.types";
import type { CreateRaffleInput } from "../types/raffle.types";
import { getDocs, orderBy, query } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import { useAuthStore } from "@/store/auth.store";

export const raffleService = {
    create: (data: CreateRaffleInput) =>
        callFunction<{ raffleId: string }>("createRaffle", data),

    update: (raffleId: string, data: Partial<CreateRaffleInput>) =>
        callFunction<{ success: boolean }>("updateRaffle", { raffleId, ...data }),

    transition: (raffleId: string, targetState: RaffleStatus) =>
        callFunction<{ success: boolean; newStatus: string }>("transitionRaffleState", { raffleId, targetState }),

    setWinner: (raffleId: string, winningNumber: number) =>
        callFunction<{ winner: string | null; message?: string }>("setWinningNumber", { raffleId, winningNumber }),

    list: async (): Promise<{ raffles: Raffle[] }> => {
        const state = useAuthStore.getState();
        const tenantId = state.user?.tenantId;
        if (!tenantId) return { raffles: [] };

        try {
            const col = tenantCollection(tenantId, "raffles");
            const q = query(col, orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const raffles = snap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Raffle[];
            return { raffles };
        } catch {
            return { raffles: [] };
        }
    },
};
