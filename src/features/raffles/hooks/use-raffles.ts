"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { raffleService } from "../services/raffle.service";
import type { CreateRaffleInput } from "../types/raffle.types";
import type { RaffleStatus } from "@/types/api.types";

export function useRaffles() {
    return useQuery({
        queryKey: ["raffles"],
        queryFn: () => raffleService.list(),
    });
}

export function useCreateRaffle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateRaffleInput) => raffleService.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["raffles"] }),
    });
}

export function useTransitionRaffle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ raffleId, targetState }: { raffleId: string; targetState: RaffleStatus }) =>
            raffleService.transition(raffleId, targetState),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["raffles"] }),
    });
}
