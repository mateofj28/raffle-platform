export const ROUTES = {
    // Auth
    LOGIN: "/login",

    // Admin
    ADMIN_DASHBOARD: "/dashboard",
    ADMIN_RAFFLES: "/raffles",
    ADMIN_RAFFLE_NEW: "/raffles/new",
    ADMIN_RAFFLE_DETAIL: (id: string) => `/raffles/${id}`,
    ADMIN_RAFFLE_EDIT: (id: string) => `/raffles/${id}/edit`,
    ADMIN_RAFFLE_TICKETS: (id: string) => `/raffles/${id}/tickets`,
    ADMIN_VENDORS: "/vendors",
    ADMIN_VENDOR_NEW: "/vendors/new",
    ADMIN_VENDOR_DETAIL: (id: string) => `/vendors/${id}`,
    ADMIN_CUSTOMERS: "/customers",
    ADMIN_CUSTOMER_NEW: "/customers/new",
    ADMIN_CUSTOMER_DETAIL: (id: string) => `/customers/${id}`,
    ADMIN_PAYMENTS: "/payments",
    ADMIN_REPORTS: "/reports",
    ADMIN_AUDIT: "/audit",
    ADMIN_SETTINGS: "/settings",

    // Vendor
    VENDOR_DASHBOARD: "/vendor/dashboard",
    VENDOR_TICKETS: "/vendor/tickets",
    VENDOR_PAYMENTS: "/vendor/payments",
} as const;
