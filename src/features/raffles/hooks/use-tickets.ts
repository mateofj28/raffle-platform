"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketService } from "../services/ticket.service";
import type { AssignTicketsInput, SellTicketInput } from "../types/raffle.types";

export function useAssignTickets() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: AssignTicketsInput) => ticketService.assign(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    });
}

export function useSellTicket() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: SellTicketInput) => ticketService.sell(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    });
}
