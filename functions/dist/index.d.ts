/**
 * Raffle Platform - Cloud Functions Entry Point
 *
 * Uses lazy exports to avoid initialization timeout on Node 24.
 */
export { setCustomClaims, createUser, updateUser, recordLoginAttempt, checkAccountLock } from "./services/auth.service";
export { createRaffle, updateRaffle, transitionRaffleState, setWinningNumber, deleteRaffle } from "./services/raffle.service";
export { assignTickets, sellTicket, unassignTickets, updateTicketClient, generateTickets } from "./services/ticket.service";
export { registerPayment, reversePayment, correctPayment } from "./services/payment.service";
export { createCustomer, updateCustomer, deleteCustomer } from "./services/customer.service";
export { createVendor, updateVendor, getVendorMetrics, deleteVendor } from "./services/vendor.service";
export { getDashboardMetrics } from "./services/dashboard.service";
export { globalSearch } from "./services/search.service";
export { exportData } from "./services/export.service";
export { payCommission } from "./services/commission.service";
export { savePairings, getPairings } from "./services/pairing.service";
export { onPaymentCreated, onAdjustmentCreated } from "./triggers/payment.triggers";
export { onTicketStatusChanged } from "./triggers/ticket.triggers";
export { aggregateMetrics } from "./scheduled/metrics.scheduled";
export { cleanupExports } from "./scheduled/cleanup.scheduled";
export { finishExpiredRaffles } from "./scheduled/finish-raffles.scheduled";
