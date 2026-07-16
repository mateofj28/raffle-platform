// ==========================================
// Firebase Types (Client-side)
// ==========================================

export interface CustomClaims {
    tenantId: string;
    role: "admin" | "vendor";
    vendorId?: string;
}

export interface AuthUser {
    uid: string;
    email: string;
    displayName: string | null;
    tenantId: string;
    role: "admin" | "vendor";
    vendorId?: string;
}
