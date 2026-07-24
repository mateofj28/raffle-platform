/**
 * Formats a number as Colombian Peso currency.
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Safely converts a Firestore value to a Date.
 * Handles: ISO string, Firestore Timestamp object, null, undefined.
 */
function toDate(value: unknown): Date | null {
    if (!value) return null;
    // Firestore Timestamp (has .toDate() method)
    if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
        return (value as { toDate: () => Date }).toDate();
    }
    // ISO string
    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    // Number (unix ms)
    if (typeof value === "number") {
        return new Date(value);
    }
    return null;
}

/**
 * Formats a date to local display format.
 */
export function formatDate(dateStr: unknown): string {
    const date = toDate(dateStr);
    if (!date) return "—";
    return new Intl.DateTimeFormat("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

/**
 * Formats a date to include time.
 */
export function formatDateTime(dateStr: unknown): string {
    const date = toDate(dateStr);
    if (!date) return "—";
    return new Intl.DateTimeFormat("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

/**
 * Formats a ticket number with leading zeros.
 */
export function formatTicketNumber(num: number, totalDigits = 5): string {
    return String(num).padStart(totalDigits, "0");
}

/**
 * Formats a percentage.
 */
export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(0)}%`;
}
