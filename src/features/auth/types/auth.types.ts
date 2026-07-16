export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthState {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

export interface AuthUser {
    uid: string;
    email: string;
    displayName: string | null;
    tenantId: string;
    role: "admin" | "vendor";
    vendorId?: string;
}
