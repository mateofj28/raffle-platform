/**
 * Fuente ÚNICA de verdad para el estado de una boleta.
 *
 * El estado se deriva de sus datos reales (cliente + dinero) y se GUARDA en el
 * documento. Debe llamarse en toda operación que modifique una boleta para que
 * el `status` persistido nunca quede desactualizado:
 *
 *  - available   : sin vendedor, sin cliente y sin abono (disponible).
 *  - assigned    : tiene vendedor y/o cliente, pero $0 abonado.
 *  - installment : tiene algún abono parcial (o pagó todo pero aún sin cliente).
 *  - sold        : tiene cliente y está pagada por completo.
 *  - cancelled   : se conserva tal cual (estado terminal, no se recalcula).
 */

export type TicketStatus =
    | "available"
    | "assigned"
    | "installment"
    | "sold"
    | "cancelled";

interface TicketLike {
    status?: string;
    vendorId?: string | null;
    customerId?: string | null;
    value?: number;
    pendingBalance?: number;
}

export function computeTicketStatus(ticket: TicketLike): TicketStatus {
    // Estado terminal: una boleta cancelada no cambia por dinero/cliente.
    if (ticket.status === "cancelled") return "cancelled";

    const value = ticket.value ?? 0;
    const pending = ticket.pendingBalance ?? value;
    const paid = value - pending; // cuánto se ha abonado
    const hasClient = !!ticket.customerId;
    const hasVendor = !!ticket.vendorId;

    // Vendida: cliente + pagada por completo.
    if (hasClient && value > 0 && paid >= value) return "sold";
    // Abonada: cualquier abono (parcial, o completo aún sin cliente).
    if (paid > 0) return "installment";
    // Asignada: tiene dueño (vendedor o cliente) pero sin abono.
    if (hasVendor || hasClient) return "assigned";
    // Disponible: sin dueño y sin abono.
    return "available";
}
