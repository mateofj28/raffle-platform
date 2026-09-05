/**
 * Raffle Platform - Cloud Functions Entry Point
 *
 * Uses lazy exports to avoid initialization timeout on Node 24.
 */

// Initialize Firebase Admin immediately (lightweight)
import { initAdmin } from "./utils/firestore";
initAdmin();

// Re-export all functions using direct imports
// Auth service
export { setCustomClaims, createUser, updateUser, recordLoginAttempt, checkAccountLock } from "./services/auth.service";

// Raffle service
export { createRaffle, updateRaffle, transitionRaffleState, setWinningNumber, deleteRaffle } from "./services/raffle.service";

// Ticket service
export { assignTickets, sellTicket, unassignTickets, updateTicketClient, generateTickets } from "./services/ticket.service";

// Payment service
export { registerPayment, reversePayment, correctPayment } from "./services/payment.service";

// Customer service
export { createCustomer, updateCustomer } from "./services/customer.service";

// Vendor service
export { createVendor, updateVendor, getVendorMetrics } from "./services/vendor.service";

// Dashboard
export { getDashboardMetrics } from "./services/dashboard.service";

// Search
export { globalSearch } from "./services/search.service";

// Export
export { exportData } from "./services/export.service";

// Commission
export { payCommission } from "./services/commission.service";

// Triggers
export { onPaymentCreated, onAdjustmentCreated } from "./triggers/payment.triggers";
export { onTicketStatusChanged } from "./triggers/ticket.triggers";

// Scheduled
export { aggregateMetrics } from "./scheduled/metrics.scheduled";
export { cleanupExports } from "./scheduled/cleanup.scheduled";
