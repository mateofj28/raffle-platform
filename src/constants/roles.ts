export const ROLES = {
    ADMIN: "admin",
    VENDOR: "vendor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
