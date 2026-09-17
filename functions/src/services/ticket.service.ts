/**
 * Ticket Service - Cloud Functions for ticket management.
 *
 * Provides:
 * - generateTickets: Batch generates tickets for a raffle (internal, non-callable)
 * - assignTickets: Assigns a range of tickets to a vendor (admin or cashier)
 * - unassignTickets: Returns assigned tickets to "available" (admin or cashier)
 * - sellTicket: Sells a ticket to a customer (admin, cashier, or vendor — vendor only their own)
 * - updateTicketClient: Changes the client on a ticket (admin, cashier, or vendor — vendor only their own)
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, requireAdminOrCashier, requireVendorOwnership, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { AppError, AppErrorCode, handleError } from "../utils/errors";
import { getDb, BATCH_SIZE, getOfficialRaffleId } from "../utils/firestore";
import { computeTicketStatus } from "../utils/ticket-status";
import { resolveTicketRef, resolveTicketRefs } from "../utils/ticket-resolve";
import { createAuditEntry } from "./audit.service";

/**
 * Valida que el raffleId sea la rifa OFICIAL (la más reciente activa/borrador).
 * Bloquea operaciones (vender, pagar, asignar) sobre rifas anteriores para
 * evitar que un admin/cajero opere por error en una rifa que no es la actual.
 */
async function assertOfficialRaffle(tenantId: string, raffleId: string): Promise<void> {
    const officialId = await getOfficialRaffleId(tenantId);
    if (officialId !== raffleId) {
        throw new AppError(
            AppErrorCode.INVALID_TRANSITION,
            "Solo puedes operar en la rifa actual. Esta es una rifa anterior."
        );
    }
}

// --- Zod Schemas ---

const assignTicketsSchema = z.object({
    raffleId: z.string().min(1),
    vendorId: z.string().min(1),
    // Supports either a range (fromNumber/toNumber) or a list of specific numbers.
    // Los números de boleta van de 0 a 9999.
    fromNumber: z.number().int().min(0).max(9999).optional(),
    toNumber: z.number().int().min(0).max(9999).optional(),
    ticketNumbers: z.array(z.number().int().min(0).max(9999)).optional(),
});

const unassignTicketsSchema = z.object({
    raffleId: z.string().min(1),
    ticketNumbers: z.array(z.number().int().min(0).max(9999)).min(1),
});

const sellTicketSchema = z.object({
    raffleId: z.string().min(1),
    ticketNumber: z.number().int().min(0).max(9999),
    customerId: z.string().min(1),
});

// --- Helpers ---

function padTicketNumber(num: number): string {
    return String(num).padStart(4, "0");
}

// --- Internal Function (non-callable) ---

/**
 * Genera las boletas de una rifa.
 * Llamada internamente por el servicio de rifas al crearla.
 *
 * Modelo:
 *  - Rifa de 1 número: 10.000 boletas; cada una juega [N] con N=0000..9999.
 *    El docId es el número con 4 dígitos.
 *  - Rifa de 2 números: 5.000 boletas; cada una juega una PAREJA arbitraria
 *    [a, b] definida por el tenant (no son consecutivos). El docId es el menor
 *    de los dos números (identificador estable de la boleta). El saldo es de la
 *    boleta completa: abonar por cualquiera de sus dos números cubre la boleta.
 *
 * `pairs` es obligatorio para rifas de 2 números (las parejas del tenant).
 */
export async function generateTickets(
    tenantId: string,
    raffleId: string,
    totalNumbers: number,
    ticketPrice: number,
    numbersPerTicket: number = 1,
    pairs?: [number, number][]
): Promise<void> {
    const db = getDb();
    const ticketsBasePath = `tenants/${tenantId}/raffles/${raffleId}/tickets`;

    // Construir la lista de boletas (cada una: docId + números que juega).
    const ticketsToCreate: { docId: string; number: number; numbers: number[] }[] = [];

    if (numbersPerTicket === 2) {
        if (!pairs || pairs.length === 0) {
            throw new AppError(
                AppErrorCode.VALIDATION_ERROR,
                "No hay parejas definidas para la rifa de 2 números."
            );
        }
        for (const [a, b] of pairs) {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            ticketsToCreate.push({ docId: padTicketNumber(lo), number: lo, numbers: [lo, hi] });
        }
    } else {
        for (let n = 0; n < totalNumbers; n++) {
            ticketsToCreate.push({ docId: padTicketNumber(n), number: n, numbers: [n] });
        }
    }

    for (let i = 0; i < ticketsToCreate.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = ticketsToCreate.slice(i, i + BATCH_SIZE);

        for (const t of chunk) {
            const ticketRef = db.collection(ticketsBasePath).doc(t.docId);
            batch.set(ticketRef, {
                number: t.number,
                numbers: t.numbers, // números de lotería que juega esta boleta
                numbersPerTicket,
                status: "available",
                customerId: null,
                vendorId: null,
                saleDate: null,
                value: ticketPrice,
                pendingBalance: ticketPrice,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        await batch.commit();
    }
}

// --- Callable Functions ---

/**
 * Assigns a range of tickets to a vendor.
 * Admin or cashier. Updates available tickets to "assigned" status with the given vendorId.
 */
export const assignTickets = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdminOrCashier(context);

            const data = validateData(assignTicketsSchema, request.data);
            const { raffleId, vendorId, fromNumber, toNumber, ticketNumbers } = data;

            // Solo se puede asignar en la rifa oficial (la actual), no en anteriores.
            await assertOfficialRaffle(context.tenantId, raffleId);

            const db = getDb();

            // Validate raffle exists and is active or draft
            const raffleRef = db.doc(`tenants/${context.tenantId}/raffles/${raffleId}`);
            const raffleSnap = await raffleRef.get();

            if (!raffleSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Rifa no encontrada.");
            }

            const raffle = raffleSnap.data()!;

            if (raffle.status !== "active" && raffle.status !== "draft") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "La rifa debe estar activa o en borrador para asignar boletas."
                );
            }

            // Determine which tickets to assign
            let numbersToAssign: number[] = [];

            if (ticketNumbers && ticketNumbers.length > 0) {
                // Mode: specific ticket numbers
                numbersToAssign = ticketNumbers;
            } else if (fromNumber !== undefined && toNumber !== undefined) {
                // Mode: range
                if (fromNumber > toNumber) {
                    throw new AppError(
                        AppErrorCode.VALIDATION_ERROR,
                        "El número inicial debe ser menor o igual al número final.",
                        { fromNumber: "Debe ser <= al número final" }
                    );
                }
                for (let n = fromNumber; n <= toNumber; n++) {
                    numbersToAssign.push(n);
                }
            } else {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Proporciona una lista de boletas o un rango (número inicial/final)."
                );
            }

            // Resolver cada número a su boleta real (docId = min de la pareja en
            // rifas de 2 números). Dos números de la misma pareja resuelven al
            // MISMO documento, así que se deduplica para no procesarlo dos veces.
            const { refs: refsToAssign } = await resolveTicketRefs(
                context.tenantId,
                raffleId,
                numbersToAssign
            );

            let assigned = 0;
            let skipped = 0;

            for (let i = 0; i < refsToAssign.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = refsToAssign.slice(i, i + BATCH_SIZE);

                for (const ticketRef of chunk) {
                    const ticketSnap = await ticketRef.get();

                    if (!ticketSnap.exists) {
                        skipped++;
                        continue;
                    }

                    const ticket = ticketSnap.data()!;

                    // Una boleta se puede (re)asignar si NO tiene cliente y NO tiene
                    // abono, sin importar su status guardado. Esto unifica la definición
                    // de "disponible" con el estado derivado que ve el usuario y evita
                    // el caso "assigned sin cliente ni dinero" que quedaba bloqueado.
                    const value = (ticket.value as number) ?? 0;
                    const pending = (ticket.pendingBalance as number) ?? value;
                    const paid = value - pending;
                    const canAssign = !ticket.customerId && paid <= 0;

                    if (!canAssign) {
                        skipped++;
                        continue;
                    }

                    // Recalcular el status con el nuevo vendedor (fuente única de verdad).
                    const newStatus = computeTicketStatus({ ...ticket, vendorId });
                    batch.update(ticketRef, {
                        status: newStatus,
                        vendorId,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    assigned++;
                }

                await batch.commit();
            }

            return { assigned, skipped };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Sells a ticket to a customer using a Firestore transaction.
 * Vendor or Admin can call.
 */
export const sellTicket = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const data = validateData(sellTicketSchema, request.data);
            const { raffleId, ticketNumber, customerId } = data;

            // Solo se puede vender en la rifa oficial (la actual), no en anteriores.
            await assertOfficialRaffle(context.tenantId, raffleId);

            const db = getDb();
            // Resolver el número (cualquiera de la pareja) a su boleta real.
            const ticketRef = await resolveTicketRef(context.tenantId, raffleId, ticketNumber);
            if (!ticketRef) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");
            }
            const ticketDocId = ticketRef.id;
            const raffleRef = db.doc(
                `tenants/${context.tenantId}/raffles/${raffleId}`
            );

            await db.runTransaction(async (transaction) => {
                const ticketSnap = await transaction.get(ticketRef);
                const raffleSnap = await transaction.get(raffleRef);

                // Validate ticket exists
                if (!ticketSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");
                }

                const ticket = ticketSnap.data()!;

                // Validate ticket status is "assigned"
                if (ticket.status !== "assigned") {
                    throw new AppError(
                        AppErrorCode.CONFLICT,
                        "La boleta ya no está disponible."
                    );
                }

                // If vendor role, validate ownership
                if (context.role === "vendor") {
                    requireVendorOwnership(context, ticket.vendorId);
                }

                // Validate raffle is active
                if (!raffleSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Rifa no encontrada.");
                }

                const raffle = raffleSnap.data()!;

                if (raffle.status === "finished" || raffle.status === "cancelled") {
                    throw new AppError(
                        AppErrorCode.INVALID_TRANSITION,
                        "No se puede vender en una rifa finalizada o cancelada."
                    );
                }

                // Recalcular el status con el nuevo cliente (fuente única de verdad).
                const newStatus = computeTicketStatus({ ...ticket, customerId });
                transaction.update(ticketRef, {
                    status: newStatus,
                    customerId,
                    saleDate: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            });

            // Audit trail
            await createAuditEntry(context.tenantId, "ticket_sold", "ticket", ticketDocId, context.uid, null, {
                raffleId, ticketNumber, customerId,
            });

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Unassigns tickets - returns them to "available" status.
 * Admin or cashier. Only tickets in "assigned" state can be unassigned.
 */
export const unassignTickets = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdminOrCashier(context);

            const data = validateData(unassignTicketsSchema, request.data);
            const { raffleId, ticketNumbers } = data;

            // Solo se puede desasignar en la rifa oficial (la actual).
            await assertOfficialRaffle(context.tenantId, raffleId);

            const db = getDb();
            // Resolver los números a boletas reales (deduplicando parejas).
            const { refs: refsToUnassign } = await resolveTicketRefs(
                context.tenantId,
                raffleId,
                ticketNumbers
            );
            let unassigned = 0;
            let skipped = 0;

            for (let i = 0; i < refsToUnassign.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = refsToUnassign.slice(i, i + BATCH_SIZE);

                for (const ticketRef of chunk) {
                    const ticketSnap = await ticketRef.get();

                    if (!ticketSnap.exists) { skipped++; continue; }

                    const ticket = ticketSnap.data()!;

                    // Se permite desasignar una boleta cuando:
                    //  - está "assigned" (asignada, sin vender), o
                    //  - no tiene cliente y no tiene ningún abono (abonado en $0),
                    //    sin importar el estado. Una boleta sin dueño ni dinero no
                    //    pierde información al liberarse.
                    const amountPaid = (ticket.value ?? 0) - (ticket.pendingBalance ?? 0);
                    const canUnassign =
                        ticket.status === "assigned" ||
                        (!ticket.customerId && amountPaid === 0);

                    if (!canUnassign) { skipped++; continue; }

                    // Boleta liberada: sin dueño, sin cliente y saldo completo → available.
                    batch.update(ticketRef, {
                        status: computeTicketStatus({ value: ticket.value ?? 0, pendingBalance: ticket.value ?? 0, vendorId: null, customerId: null }),
                        vendorId: null,
                        customerId: null,
                        pendingBalance: ticket.value ?? 0,
                        saleDate: null,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    unassigned++;
                }

                await batch.commit();
            }

            return { unassigned, skipped };
        } catch (error) {
            handleError(error);
        }
    }
);


/**
 * Updates the client on a ticket.
 * Admin, cashier, or vendor (a vendor may only update their own tickets — ownership enforced below).
 * Works on any ticket status (assigned, sold, installment, paid).
 */
export const updateTicketClient = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            // Admin, cashier, or vendor can update client

            const schema = z.object({
                raffleId: z.string().min(1),
                ticketNumber: z.number().int().min(0).max(9999),
                // customerId vacío/null = quitar el cliente (dejar la boleta sin cliente).
                customerId: z.string().nullable().optional(),
            });

            const data = validateData(schema, request.data);
            const { raffleId, ticketNumber } = data;
            const customerId = data.customerId && data.customerId.length > 0 ? data.customerId : null;

            // Solo se puede modificar el cliente en la rifa oficial (la actual).
            await assertOfficialRaffle(context.tenantId, raffleId);

            // Resolver el número (cualquiera de la pareja) a su boleta real.
            const ticketRef = await resolveTicketRef(context.tenantId, raffleId, ticketNumber);
            if (!ticketRef) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");
            }

            const ticketSnap = await ticketRef.get();
            if (!ticketSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");
            }

            const ticket = ticketSnap.data()!;

            // If vendor role, validate ownership — a vendor can only touch their own tickets
            if (context.role === "vendor") {
                requireVendorOwnership(context, ticket.vendorId);
            }

            // Recalcular el status con el nuevo cliente (fuente única de verdad).
            const newStatus = computeTicketStatus({ ...ticket, customerId });
            const updates: Record<string, unknown> = {
                customerId,
                status: newStatus,
                updatedAt: FieldValue.serverTimestamp(),
            };
            // saleDate: se pone al ganar cliente pagado; se limpia al quedar sin cliente.
            if (!customerId) updates.saleDate = null;
            else if (!ticket.saleDate) updates.saleDate = FieldValue.serverTimestamp();

            await ticketRef.update(updates);

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);
