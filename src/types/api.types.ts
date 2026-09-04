// ==========================================
// API Types - Shared between frontend and Cloud Functions
// ==========================================

// --- Raffle ---

export type RaffleStatus = "draft" | "active" | "finished" | "cancelled";

export interface Raffle {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    prize: string;
    prizeValue: number;
    startDate: string;
    endDate: string;
    drawDate: string;
    lottery: string;
    winningNumber: number | null;
    status: RaffleStatus;
    ticketPrice: number;
    totalTickets: number;
    numbersPerTicket: number;
    semester: 1 | 2;
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
    | "winner";

export interface Ticket {
    number: number;
    numbers: number[];
    numbersPerTicket: number;
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
    | "nequi"
    | "daviplata"
    | "transfer";

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

// --- Tenant Settings ---

/** Métodos de pago válidos del sistema. */
export type ActivePaymentMethod = "cash" | "nequi" | "daviplata" | "transfer";

export interface BusinessInfo {
    name: string;
    nit: string;
    phone: string;
}

export interface TenantSettings {
    /** Comisión del vendedor como fracción (0.30 = 30%). El resto es de la empresa. */
    commissionRate: number;
    /** Métodos de pago habilitados. */
    activePaymentMethods: ActivePaymentMethod[];
    /** Precio de boleta sugerido al crear una rifa. */
    defaultTicketPrice: number;
    /** Monto mínimo permitido para un abono. */
    minInstallment: number;
    /** Datos del negocio. */
    businessInfo: BusinessInfo;
    timezone: string;
    currency: string;
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
    commissionRate: 0.30,
    activePaymentMethods: ["cash", "nequi", "daviplata", "transfer"],
    defaultTicketPrice: 60000,
    minInstallment: 5000,
    businessInfo: { name: "", nit: "", phone: "" },
    timezone: "America/Bogota",
    currency: "COP",
};

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

// --- Vendor Metrics ---

export interface VendorMetrics {
    assignedCount: number;
    soldCount: number;
    availableCount: number;
    paidCount: number;
    installmentCount: number;
    cancelledCount: number;
    pendingCount: number;
    moneyCollected: number;
    commissionGenerated: number;
    commissionPaid: number;
    pendingBalanceToDeliver: number;
    ranking: number;
}

// --- Dashboard Metrics ---

export interface DashboardMetrics {
    sales: {
        dailySales: number;
        monthlySales: number;
        moneyCollected: number;
        moneyPending: number;
    };
    raffles: {
        activeCount: number;
        finishedCount: number;
        ticketsSold: number;
        ticketsAvailable: number;
        ticketsCancelled: number;
    };
    people: {
        vendorsCount: number;
        customersCount: number;
        topVendors: Array<{ id: string; name: string; salesCount: number }>;
        topRaffles: Array<{ id: string; name: string; revenue: number }>;
        topCustomers: Array<{ id: string; name: string; purchases: number }>;
    };
    financial: {
        commissionsPaid: number;
        commissionsPending: number;
        totalProfit: number;
        dailyIncome: number;
        monthlyIncome: number;
    };
}
