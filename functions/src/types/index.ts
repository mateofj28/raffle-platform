// ==========================================
// Raffle Platform - Shared Types
// ==========================================

// --- Raffle ---

export type RaffleStatus = "draft" | "active" | "finished" | "cancelled";

export interface Raffle {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    prize: string;
    startDate: string;
    endDate: string;
    drawDate: string;
    lottery: string;
    winningNumber: number | null;
    status: RaffleStatus;
    ticketPrice: number;
    totalTickets: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

// --- Ticket ---

export type TicketStatus =
    | "available"
    | "assigned"
    | "sold"
    | "paid"
    | "installment"
    | "cancelled"
    | "winner";

export interface Ticket {
    number: number;
    status: TicketStatus;
    customerId: string | null;
    vendorId: string | null;
    saleDate: string | null;
    value: number;
    pendingBalance: number;
    createdAt: string;
    updatedAt: string;
}

// --- Customer ---

export interface Customer {
    id: string;
    name: string;
    document: string;
    phone: string;
    whatsapp: string;
    address: string;
    city: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

// --- Vendor ---

export type VendorStatus = "active" | "inactive" | "suspended";

export interface Vendor {
    id: string;
    name: string;
    document: string;
    phone: string;
    whatsapp: string;
    status: VendorStatus;
    userId: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

// --- Payment ---

export type PaymentType = "payment" | "installment";

export type PaymentMethod =
    | "cash"
    | "transfer"
    | "card"
    | "nequi"
    | "daviplata"
    | "other";

export interface Payment {
    id: string;
    ticketId: string;
    raffleId: string;
    customerId: string;
    vendorId: string;
    amount: number;
    type: PaymentType;
    method: PaymentMethod;
    date: string;
    observations: string;
    createdAt: string;
    createdBy: string;
}

// --- Adjustment ---

export interface Adjustment {
    id: string;
    paymentId: string;
    ticketId: string;
    raffleId: string;
    amount: number;
    reason: string;
    authorizedBy: string;
    createdAt: string;
}

// --- Commission ---

export type CommissionStatus = "generated" | "paid" | "reversed";

export interface Commission {
    id: string;
    ticketId: string;
    raffleId: string;
    vendorId: string;
    ticketValue: number;
    commissionAmount: number;
    companyProfit: number;
    status: CommissionStatus;
    generatedAt: string;
    paidAt: string | null;
    reversedAt: string | null;
}

// --- Audit Trail ---

export type AuditOperationType =
    | "create"
    | "update"
    | "cancel"
    | "payment"
    | "reversal"
    | "transition";

export interface AuditTrailEntry {
    id: string;
    operationType: AuditOperationType;
    entityType: string;
    entityId: string;
    userId: string;
    tenantId: string;
    timestamp: string;
    ipAddress: string | null;
    metadata: Record<string, unknown>;
}

// --- Metrics ---

export interface SalesMetrics {
    dailySales: number;
    monthlySales: number;
    moneyCollected: number;
    moneyPending: number;
    lastUpdated: string;
}

export interface RaffleMetrics {
    activeCount: number;
    finishedCount: number;
    ticketsSold: number;
    ticketsAvailable: number;
    ticketsCancelled: number;
    lastUpdated: string;
}

export interface PeopleMetrics {
    vendorsCount: number;
    customersCount: number;
    topVendors: Array<{ id: string; name: string; salesCount: number }>;
    topRaffles: Array<{ id: string; name: string; revenue: number }>;
    topCustomers: Array<{ id: string; name: string; purchases: number }>;
    lastUpdated: string;
}

export interface FinancialMetrics {
    commissionsPaid: number;
    commissionsPending: number;
    totalProfit: number;
    profitByRaffle: Array<{ raffleId: string; name: string; profit: number }>;
    dailyIncome: number;
    monthlyIncome: number;
    lastUpdated: string;
}
