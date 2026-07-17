/**
 * Raffle Platform - Cloud Functions Entry Point
 *
 * All callable functions, triggers, and scheduled functions
 * are exported from here.
 */
export { setCustomClaims, createUser, recordLoginAttempt, checkAccountLock } from "./services/auth.service.js";
export { createRaffle, updateRaffle, transitionRaffleState, setWinningNumber } from "./services/raffle.service.js";
export { assignTickets, sellTicket, cancelTicket } from "./services/ticket.service.js";
export { generateTickets } from "./services/ticket.service.js";
export { registerPayment, reversePayment } from "./services/payment.service.js";
export { createCustomer, updateCustomer } from "./services/customer.service.js";
export { createVendor, updateVendor, getVendorMetrics } from "./services/vendor.service.js";
export { getDashboardMetrics } from "./services/dashboard.service.js";
export { globalSearch } from "./services/search.service.js";
export { exportData } from "./services/export.service.js";
export { payCommission } from "./services/commission.service.js";
export { onPaymentCreated, onAdjustmentCreated } from "./triggers/payment.triggers.js";
export { onTicketStatusChanged } from "./triggers/ticket.triggers.js";
export { aggregateMetrics } from "./scheduled/metrics.scheduled.js";
export { cleanupExports } from "./scheduled/cleanup.scheduled.js";
//# sourceMappingURL=index.d.ts.map