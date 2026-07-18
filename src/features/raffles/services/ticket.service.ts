import { callFunction } from "@/services/firebase-callable";
import type { AssignTicketsInput, SellTicketInput } from "../types/raffle.types";

export const ticketService = {
    assign: (data: AssignTicketsInput) =>
        callFunction<{ assigned: number; skipped: number }>("assignTickets", data),

    unassign: (raffleId: string, ticketNumbers: number[]) =>
        callFunction<{ unassigned: number; skipped: number }>("unassignTickets", { raffleId, ticketNumbers }),

    sell: (data: SellTicketInput) =>
        callFunction<{ success: boolean }>("sellTicket", data),

    cancel: (raffleId: string, ticketNumber: number) =>
        callFunction<{ success: boolean }>("cancelTicket", { raffleId, ticketNumber }),
};
