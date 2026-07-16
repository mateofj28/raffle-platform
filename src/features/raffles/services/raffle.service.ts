import { callFunction } from "@/services/firebase-callable";
import type { Raffle, RaffleStatus } from "@/types/api.types";
import type { CreateRaffleInput } from "../types/raffle.types";

export const raffleService = {
    create: (data: CreateRaffleInput) =>
        callFunction<{ raffleId: string }>("createRaffle", data),

    update: (raffleId: string, data: Partial<CreateRaffleInput>) =>
        callFunction<{ success: boolean }>("updateRaffle", { raffleId, ...data }),

    transition: (raffleId: string, targetState: RaffleStatus) =>
        callFunction<{ success: boolean; newStatus: string }>("transitionRaffleState", { raffleId, targetState }),

    setWinner: (raffleId: string, winningNumber: number) =>
        callFunction<{ winner: string | null; message?: string }>("setWinningNumber", { raffleId, winningNumber }),

    list: () =>
        callFunction<{ raffles: Raffle[] }>("listRaffles").catch(() => ({ raffles: [] })),
};
