"use strict";
/**
 * Raffle Platform - Cloud Functions Entry Point
 *
 * Uses lazy exports to avoid initialization timeout on Node 24.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishExpiredRaffles = exports.cleanupExports = exports.aggregateMetrics = exports.onTicketStatusChanged = exports.onAdjustmentCreated = exports.onPaymentCreated = exports.getPairings = exports.savePairings = exports.payCommission = exports.exportData = exports.globalSearch = exports.getDashboardMetrics = exports.deleteVendor = exports.getVendorMetrics = exports.updateVendor = exports.createVendor = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.correctPayment = exports.reversePayment = exports.registerPayment = exports.generateTickets = exports.updateTicketClient = exports.unassignTickets = exports.sellTicket = exports.assignTickets = exports.deleteRaffle = exports.setWinningNumber = exports.transitionRaffleState = exports.updateRaffle = exports.createRaffle = exports.checkAccountLock = exports.recordLoginAttempt = exports.updateUser = exports.createUser = exports.setCustomClaims = void 0;
// Initialize Firebase Admin immediately (lightweight)
const firestore_1 = require("./utils/firestore");
(0, firestore_1.initAdmin)();
// Re-export all functions using direct imports
// Auth service
var auth_service_1 = require("./services/auth.service");
Object.defineProperty(exports, "setCustomClaims", { enumerable: true, get: function () { return auth_service_1.setCustomClaims; } });
Object.defineProperty(exports, "createUser", { enumerable: true, get: function () { return auth_service_1.createUser; } });
Object.defineProperty(exports, "updateUser", { enumerable: true, get: function () { return auth_service_1.updateUser; } });
Object.defineProperty(exports, "recordLoginAttempt", { enumerable: true, get: function () { return auth_service_1.recordLoginAttempt; } });
Object.defineProperty(exports, "checkAccountLock", { enumerable: true, get: function () { return auth_service_1.checkAccountLock; } });
// Raffle service
var raffle_service_1 = require("./services/raffle.service");
Object.defineProperty(exports, "createRaffle", { enumerable: true, get: function () { return raffle_service_1.createRaffle; } });
Object.defineProperty(exports, "updateRaffle", { enumerable: true, get: function () { return raffle_service_1.updateRaffle; } });
Object.defineProperty(exports, "transitionRaffleState", { enumerable: true, get: function () { return raffle_service_1.transitionRaffleState; } });
Object.defineProperty(exports, "setWinningNumber", { enumerable: true, get: function () { return raffle_service_1.setWinningNumber; } });
Object.defineProperty(exports, "deleteRaffle", { enumerable: true, get: function () { return raffle_service_1.deleteRaffle; } });
// Ticket service
var ticket_service_1 = require("./services/ticket.service");
Object.defineProperty(exports, "assignTickets", { enumerable: true, get: function () { return ticket_service_1.assignTickets; } });
Object.defineProperty(exports, "sellTicket", { enumerable: true, get: function () { return ticket_service_1.sellTicket; } });
Object.defineProperty(exports, "unassignTickets", { enumerable: true, get: function () { return ticket_service_1.unassignTickets; } });
Object.defineProperty(exports, "updateTicketClient", { enumerable: true, get: function () { return ticket_service_1.updateTicketClient; } });
Object.defineProperty(exports, "generateTickets", { enumerable: true, get: function () { return ticket_service_1.generateTickets; } });
// Payment service
var payment_service_1 = require("./services/payment.service");
Object.defineProperty(exports, "registerPayment", { enumerable: true, get: function () { return payment_service_1.registerPayment; } });
Object.defineProperty(exports, "reversePayment", { enumerable: true, get: function () { return payment_service_1.reversePayment; } });
Object.defineProperty(exports, "correctPayment", { enumerable: true, get: function () { return payment_service_1.correctPayment; } });
// Customer service
var customer_service_1 = require("./services/customer.service");
Object.defineProperty(exports, "createCustomer", { enumerable: true, get: function () { return customer_service_1.createCustomer; } });
Object.defineProperty(exports, "updateCustomer", { enumerable: true, get: function () { return customer_service_1.updateCustomer; } });
Object.defineProperty(exports, "deleteCustomer", { enumerable: true, get: function () { return customer_service_1.deleteCustomer; } });
// Vendor service
var vendor_service_1 = require("./services/vendor.service");
Object.defineProperty(exports, "createVendor", { enumerable: true, get: function () { return vendor_service_1.createVendor; } });
Object.defineProperty(exports, "updateVendor", { enumerable: true, get: function () { return vendor_service_1.updateVendor; } });
Object.defineProperty(exports, "getVendorMetrics", { enumerable: true, get: function () { return vendor_service_1.getVendorMetrics; } });
Object.defineProperty(exports, "deleteVendor", { enumerable: true, get: function () { return vendor_service_1.deleteVendor; } });
// Dashboard
var dashboard_service_1 = require("./services/dashboard.service");
Object.defineProperty(exports, "getDashboardMetrics", { enumerable: true, get: function () { return dashboard_service_1.getDashboardMetrics; } });
// Search
var search_service_1 = require("./services/search.service");
Object.defineProperty(exports, "globalSearch", { enumerable: true, get: function () { return search_service_1.globalSearch; } });
// Export
var export_service_1 = require("./services/export.service");
Object.defineProperty(exports, "exportData", { enumerable: true, get: function () { return export_service_1.exportData; } });
// Commission
var commission_service_1 = require("./services/commission.service");
Object.defineProperty(exports, "payCommission", { enumerable: true, get: function () { return commission_service_1.payCommission; } });
// Pairings (parejas de números para rifas de 2 números)
var pairing_service_1 = require("./services/pairing.service");
Object.defineProperty(exports, "savePairings", { enumerable: true, get: function () { return pairing_service_1.savePairings; } });
Object.defineProperty(exports, "getPairings", { enumerable: true, get: function () { return pairing_service_1.getPairings; } });
// Triggers
var payment_triggers_1 = require("./triggers/payment.triggers");
Object.defineProperty(exports, "onPaymentCreated", { enumerable: true, get: function () { return payment_triggers_1.onPaymentCreated; } });
Object.defineProperty(exports, "onAdjustmentCreated", { enumerable: true, get: function () { return payment_triggers_1.onAdjustmentCreated; } });
var ticket_triggers_1 = require("./triggers/ticket.triggers");
Object.defineProperty(exports, "onTicketStatusChanged", { enumerable: true, get: function () { return ticket_triggers_1.onTicketStatusChanged; } });
// Scheduled
var metrics_scheduled_1 = require("./scheduled/metrics.scheduled");
Object.defineProperty(exports, "aggregateMetrics", { enumerable: true, get: function () { return metrics_scheduled_1.aggregateMetrics; } });
var cleanup_scheduled_1 = require("./scheduled/cleanup.scheduled");
Object.defineProperty(exports, "cleanupExports", { enumerable: true, get: function () { return cleanup_scheduled_1.cleanupExports; } });
var finish_raffles_scheduled_1 = require("./scheduled/finish-raffles.scheduled");
Object.defineProperty(exports, "finishExpiredRaffles", { enumerable: true, get: function () { return finish_raffles_scheduled_1.finishExpiredRaffles; } });
//# sourceMappingURL=index.js.map