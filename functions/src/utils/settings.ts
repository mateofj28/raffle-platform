/**
 * Tenant Settings - tipo, valores por defecto y helper de lectura.
 *
 * La configuración vive en el documento `tenants/{tenantId}.settings`.
 * Estos helpers son la fuente única para leer settings desde el backend
 * (triggers, validaciones, servicios), aplicando defaults cuando falten.
 */

import { getDb } from "./firestore";

/** Métodos de pago válidos del sistema. */
export const PAYMENT_METHOD_VALUES = ["cash", "nequi", "daviplata", "transfer"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];

export interface BusinessInfo {
    name: string;
    nit: string;
    phone: string;
}

export interface TenantSettings {
    /** Comisión del vendedor como fracción (0.30 = 30%). El resto (1 - rate) es de la empresa. */
    commissionRate: number;
    /** Métodos de pago habilitados para operar. */
    activePaymentMethods: PaymentMethodValue[];
    /** Precio de boleta sugerido al crear una rifa. */
    defaultTicketPrice: number;
    /** Monto mínimo permitido para un abono. */
    minInstallment: number;
    /** Datos del negocio (para comprobantes, encabezados, etc.). */
    businessInfo: BusinessInfo;
    /** Zona horaria y moneda (ya existían). */
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

/**
 * Combina los settings guardados con los defaults, garantizando que
 * ningún campo quede indefinido aunque el documento sea antiguo/parcial.
 */
export function normalizeSettings(raw: unknown): TenantSettings {
    const s = (raw ?? {}) as Partial<TenantSettings>;
    const d = DEFAULT_TENANT_SETTINGS;

    const rate = typeof s.commissionRate === "number" && s.commissionRate >= 0 && s.commissionRate <= 1
        ? s.commissionRate
        : d.commissionRate;

    const methods = Array.isArray(s.activePaymentMethods) && s.activePaymentMethods.length > 0
        ? s.activePaymentMethods.filter((m): m is PaymentMethodValue =>
            (PAYMENT_METHOD_VALUES as readonly string[]).includes(m as string))
        : d.activePaymentMethods;

    return {
        commissionRate: rate,
        activePaymentMethods: methods.length > 0 ? methods : d.activePaymentMethods,
        defaultTicketPrice: typeof s.defaultTicketPrice === "number" && s.defaultTicketPrice > 0
            ? s.defaultTicketPrice : d.defaultTicketPrice,
        minInstallment: typeof s.minInstallment === "number" && s.minInstallment > 0
            ? s.minInstallment : d.minInstallment,
        businessInfo: {
            name: s.businessInfo?.name ?? d.businessInfo.name,
            nit: s.businessInfo?.nit ?? d.businessInfo.nit,
            phone: s.businessInfo?.phone ?? d.businessInfo.phone,
        },
        timezone: s.timezone ?? d.timezone,
        currency: s.currency ?? d.currency,
    };
}

/**
 * Lee y normaliza los settings de un tenant desde Firestore.
 * Devuelve defaults si el tenant o sus settings no existen.
 */
export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const db = getDb();
    const snap = await db.doc(`tenants/${tenantId}`).get();
    if (!snap.exists) return DEFAULT_TENANT_SETTINGS;
    return normalizeSettings(snap.data()?.settings);
}
