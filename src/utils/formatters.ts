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
 * Formats a date string to local display format.
 */
export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

/**
 * Formats a date string to include time.
 */
export function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
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
