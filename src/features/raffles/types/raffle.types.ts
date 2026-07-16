import type { RaffleStatus, TicketStatus } from "@/types/api.types";

export interface CreateRaffleInput {
    name: string;
    description: string;
    prize: string;
    startDate: string;
    endDate: string;
    drawDate: string;
    lottery: string;
    ticketPrice: number;
    totalTickets: number;
}

export interface RaffleFilters {
    status?: RaffleStatus;
    page?: number;
    pageSize?: number;
}

export interface TicketFilters {
    raffleId: string;
    status?: TicketStatus;
    vendorId?: string;
    page?: number;
    pageSize?: number;
}

export interface AssignTicketsInput {
    raffleId: string;
    vendorId: string;
    fromNumber: number;
    toNumber: number;
}

export interface SellTicketInput {
    raffleId: string;
    ticketNumber: number;
    customerId: string;
}
