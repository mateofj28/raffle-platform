/**
 * Estado VISIBLE de una boleta, derivado de sus datos reales (cliente + dinero),
 * según la definición del negocio:
 *
 *  - Disponible: la boleta la tiene un vendedor pero SIN cliente y SIN abono
 *    (también las que ni siquiera están asignadas a un vendedor).
 *  - Asignada:   tiene cliente pero $0 abonado.
 *  - Abonada:    tiene un abono parcial (>$0 y menor al total), con o sin cliente.
 *  - Vendida:    tiene cliente y está pagada por completo (fusiona vendida + pagada).
 *
 * Este estado se calcula solo para MOSTRAR (badges y conteos); no cambia lo que
 * se guarda en la base de datos.
 */

export type DerivedTicketStatus = "available" | "assigned" | "installment" | "sold";

interface TicketLike {
    customerId?: string | null;
    value?: number;
    pendingBalance?: number;
    status?: string;
}

export function deriveTicketStatus(ticket: TicketLike): DerivedTicketStatus {
    const value = ticket.value ?? 0;
    const pending = ticket.pendingBalance ?? value;
    const paid = value - pending; // cuánto se ha abonado
    const hasClient = !!ticket.customerId;

    // Vendida: SOLO si tiene cliente Y está pagada por completo.
    if (hasClient && value > 0 && paid >= value) return "sold";
    // Abonada: si hay cualquier abono (parcial o completo) pero aún no califica
    // como vendida (p. ej. pagó todo pero todavía no tiene cliente asignado).
    if (paid > 0) return "installment";
    // Sin abono, con cliente → Asignada.
    if (hasClient) return "assigned";
    // Sin cliente y sin abono → Disponible.
    return "available";
}

/** Etiqueta y color para el estado derivado. */
export const DERIVED_STATUS_CONFIG: Record<DerivedTicketStatus, { label: string; color: string }> = {
    available: { label: "Disponible", color: "default" },
    assigned: { label: "Asignada", color: "warning" },
    installment: { label: "Abonada", color: "danger" },
    sold: { label: "Vendida", color: "success" },
};
