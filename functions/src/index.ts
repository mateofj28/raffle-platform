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
export { setCustomClaims, createUser, updateUser, setUserDisabled, recordLoginAttempt, checkAccountLock } from "./services/auth.service";

// Raffle service
export { createRaffle, updateRaffle, transitionRaffleState, setWinningNumber, deleteRaffle } from "./services/raffle.service";

// Ticket service
export { assignTickets, sellTicket, unassignTickets, updateTicketClient, assignTicketsToCustomer, generateTickets } from "./services/ticket.service";

// Payment service
export { registerPayment, reversePayment, correctPayment } from "./services/payment.service";

// Customer service
export { createCustomer, updateCustomer, deleteCustomer } from "./services/customer.service";

// Vendor service
export { createVendor, updateVendor, getVendorMetrics, deleteVendor } from "./services/vendor.service";

// Search
export { globalSearch } from "./services/search.service";

// Export
export { exportData } from "./services/export.service";

// Import (carga masiva desde Excel)
export { importRaffleData } from "./services/import.service";

// Commission
export { payCommission } from "./services/commission.service";

// Pairings (parejas de números para rifas de 2 números)
export { savePairings, getPairings } from "./services/pairing.service";

// Triggers
export { onPaymentCreated, onAdjustmentCreated } from "./triggers/payment.triggers";

// Scheduled
export { cleanupExports } from "./scheduled/cleanup.scheduled";
export { finishExpiredRaffles } from "./scheduled/finish-raffles.scheduled";

// NOTA: se eliminó aggregateMetrics (scheduled cada 5 min), getDashboardMetrics y
// onTicketStatusChanged. Alimentaban/leían la colección metrics/*, que el front NO
// consulta (el dashboard calcula bajo demanda al abrirse). aggregateMetrics leía las
// ~10.000 boletas repetidamente cada 5 min y disparó millones de lecturas de Firestore.
