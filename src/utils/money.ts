/**
 * Reparto de un pago entre cajero (70%) y comisión del vendedor (30%).
 *
 * Regla: la comisión del vendedor es el 30% redondeado, y lo que recibe el
 * cajero es el RESTO exacto (total − comisión). Así las dos partes SIEMPRE
 * suman el total, sin perder ni ganar un peso por redondeo separado.
 *
 * (Antes se hacía Math.floor(total*0.70) y Math.floor(total*0.30) por separado,
 * lo que dejaba faltando 1 peso cuando el 70/30 no daba entero.)
 */
export const VENDOR_COMMISSION_RATE = 0.30;

export function splitPayment(total: number): { cashier: number; commission: number } {
    const commission = Math.round(total * VENDOR_COMMISSION_RATE);
    const cashier = total - commission;
    return { cashier, commission };
}

/** Solo la comisión del vendedor (30% redondeado). */
export function vendorCommission(total: number): number {
    return Math.round(total * VENDOR_COMMISSION_RATE);
}

/** Solo lo que recibe el cajero (el resto tras la comisión). */
export function cashierShare(total: number): number {
    return total - vendorCommission(total);
}
