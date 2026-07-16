import type { RaffleStatus, TicketStatus, CommissionStatus } from "@/types/api.types";

// --- Raffle State Machine ---

export const RAFFLE_STATUSES: Record<RaffleStatus, { label: string; color: string }> = {
    draft: { label: "Borrador", color: "default" },
    active: { label: "Activa", color: "success" },
    finished: { label: "Finalizada", color: "primary" },
    cancelled: { label: "Cancelada", color: "danger" },
};

export const VALID_RAFFLE_TRANSITIONS: Record<RaffleStatus, RaffleStatus[]> = {
    draft: ["active", "cancelled"],
    active: ["finished", "cancelled"],
    finished: [], // No transitions except setWinningNumber
    cancelled: [],
};

// --- Ticket State Machine ---

export const TICKET_STATUSES: Record<TicketStatus, { label: string; color: string }> = {
    available: { label: "Disponible", color: "default" },
    assigned: { label: "Asignada", color: "warning" },
    sold: { label: "Vendida", color: "primary" },
    paid: { label: "Pagada", color: "success" },
    installment: { label: "Abonada", color: "secondary" },
    cancelled: { label: "Cancelada", color: "danger" },
    winner: { label: "Ganadora", color: "success" },
};

// --- Commission Statuses ---

export const COMMISSION_STATUSES: Record<CommissionStatus, { label: string; color: string }> = {
    generated: { label: "Generada", color: "warning" },
    paid: { label: "Pagada", color: "success" },
    reversed: { label: "Reversada", color: "danger" },
};

// --- Payment Methods ---

export const PAYMENT_METHODS = [
    { value: "cash", label: "Efectivo" },
    { value: "transfer", label: "Transferencia" },
    { value: "card", label: "Tarjeta" },
    { value: "nequi", label: "Nequi" },
    { value: "daviplata", label: "Daviplata" },
    { value: "other", label: "Otro" },
] as const;

// --- Pagination ---

export const DEFAULT_PAGE_SIZE = 100;
export const VENDOR_PAGE_SIZE = 50;
export const MAX_TICKETS_PER_RAFFLE = 50_000;
export const COMMISSION_RATE = 0.30;
