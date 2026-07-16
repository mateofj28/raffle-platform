import type { RaffleStatus, TicketStatus } from "@/types/api.types";
import { VALID_RAFFLE_TRANSITIONS } from "@/constants/statuses";

/**
 * Validates if a raffle state transition is allowed.
 */
export function isValidRaffleTransition(
    currentStatus: RaffleStatus,
    targetStatus: RaffleStatus
): boolean {
    return VALID_RAFFLE_TRANSITIONS[currentStatus].includes(targetStatus);
}

/**
 * Validates if a ticket can be cancelled based on its current status.
 */
export function canCancelTicket(status: TicketStatus): boolean {
    return ["available", "assigned", "sold"].includes(status);
}

/**
 * Validates if a ticket can accept payments.
 */
export function canAcceptPayment(status: TicketStatus): boolean {
    return ["sold", "installment"].includes(status);
}
