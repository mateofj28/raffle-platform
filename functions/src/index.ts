/**
 * Raffle Platform - Cloud Functions Entry Point
 *
 * All callable functions, triggers, and scheduled functions
 * are exported from here.
 */

// Initialize Firebase Admin
import { initAdmin } from "./utils/firestore";
initAdmin();

// Auth service
export { setCustomClaims, createUser, recordLoginAttempt, checkAccountLock } from "./services/auth.service";

// Raffle service
export { createRaffle, updateRaffle, transitionRaffleState, setWinningNumber } from "./services/raffle.service";
// Ticket service
export { assignTickets, sellTicket, cancelTicket } from "./services/ticket.service";
export { generateTickets } from "./services/ticket.service";
export { registerPayment, reversePayment } from "./services/payment.service";
export { createCustomer, updateCustomer } from "./services/customer.service";
export { createVendor, updateVendor, getVendorMetrics } from "./services/vendor.service";
export { getDashboardMetrics } from "./services/dashboard.service";
export { globalSearch } from "./services/search.service";
export { exportData } from "./services/export.service";
export { payCommission } from "./services/commission.service";

// Triggers
export { onPaymentCreated, onAdjustmentCreated } from "./triggers/payment.triggers";
export { onTicketStatusChanged } from "./triggers/ticket.triggers";

// Scheduled
export { aggregateMetrics } from "./scheduled/metrics.scheduled";
export { cleanupExports } from "./scheduled/cleanup.scheduled";
