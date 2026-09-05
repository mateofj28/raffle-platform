/**
 * Raffle Service - Cloud Functions for raffle management.
 *
 * Provides:
 * - createRaffle: Creates a new raffle in Draft state
 * - updateRaffle: Updates raffle fields (blocked if finished/cancelled)
 * - transitionRaffleState: State machine transitions for raffle lifecycle
 * - setWinningNumber: Sets the winning number on a finished raffle
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { AppError, AppErrorCode, handleError } from "../utils/errors";
import { tenantCollection, getDb, BATCH_SIZE } from "../utils/firestore";
import { createAuditEntry } from "./audit.service";
import type { RaffleStatus } from "../types/index";

// --- Schemas ---

const createRaffleSchema = z.object({
    name: z.string().min(1).max(150),
    description: z.string().min(1).max(1000),
    prize: z.string().min(1).max(200),
    prizeValue: z.number().int().nonnegative(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    drawDate: z.string().min(1),
    lottery: z.string().min(1),
    ticketPrice: z.number().int().positive(),
    numbersPerTicket: z.number().int().min(1).max(2).default(1),
});

const updateRaffleSchema = z.object({
    raffleId: z.string().min(1),
    name: z.string().min(1).max(150).optional(),
    description: z.string().min(1).max(1000).optional(),
    prize: z.string().min(1).max(200).optional(),
    prizeValue: z.number().int().nonnegative().optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    drawDate: z.string().min(1).optional(),
    lottery: z.string().min(1).optional(),
    ticketPrice: z.number().int().positive().optional(),
    numbersPerTicket: z.number().int().min(1).max(2).optional(),
});

const transitionRaffleStateSchema = z.object({
    raffleId: z.string().min(1),
    targetState: z.enum(["active", "finished", "cancelled"]),
});

const setWinningNumberSchema = z.object({
    raffleId: z.string().min(1),
    winningNumber: z.number().int().min(0).max(9999),
});

const deleteRaffleSchema = z.object({
    raffleId: z.string().min(1),
});

// --- Valid Transitions ---

const VALID_TRANSITIONS: Record<RaffleStatus, RaffleStatus[]> = {
    draft: ["active", "cancelled"],
    active: ["finished", "cancelled"],
    finished: [],
    cancelled: [],
};

// --- Helper Functions ---

/**
 * Determines the semester (1 or 2) based on the start date.
 * January-June = 1, July-December = 2
 */
function getSemester(dateString: string): 1 | 2 {
    const month = new Date(dateString).getMonth() + 1; // 1-12
    return month <= 6 ? 1 : 2;
}

// --- Callable Functions ---

/**
 * Creates a new raffle in Draft state.
 * Admin-only.
 */
export const createRaffle = onCall(
    { region: "us-central1", timeoutSeconds: 300 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(createRaffleSchema, request.data);

            const rafflesRef = tenantCollection(context.tenantId, "raffles");
            const newRaffleRef = rafflesRef.doc();
            const raffleId = newRaffleRef.id;

            // Los números siempre son 10.000 (0000..9999). La cantidad de boletas
            // depende de cuántos números tenga cada una: 1 → 10.000 boletas, 2 → 5.000.
            const TOTAL_NUMBERS = 10000;
            const totalTickets = Math.floor(TOTAL_NUMBERS / data.numbersPerTicket);

            await newRaffleRef.set({
                id: raffleId,
                name: data.name,
                description: data.description,
                prize: data.prize,
                prizeValue: data.prizeValue,
                startDate: data.startDate,
                endDate: data.endDate,
                drawDate: data.drawDate,
                lottery: data.lottery,
                ticketPrice: data.ticketPrice,
                totalTickets,
                numbersPerTicket: data.numbersPerTicket,
                semester: getSemester(data.startDate),
                status: "draft" as RaffleStatus,
                winningNumber: null,
                imageUrl: "",
                createdBy: context.uid,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Generate tickets for the raffle (se le pasa el total de NÚMEROS)
            const { generateTickets } = await import("./ticket.service");
            await generateTickets(context.tenantId, raffleId, TOTAL_NUMBERS, data.ticketPrice, data.numbersPerTicket);

            // Audit trail
            await createAuditEntry(context.tenantId, "raffle_created", "raffle", raffleId, context.uid, null, {
                name: data.name, totalTickets, ticketPrice: data.ticketPrice,
            });

            return { raffleId };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Updates raffle fields.
 * Admin-only. Blocked if raffle is in "finished" or "cancelled" state.
 */
export const updateRaffle = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(updateRaffleSchema, request.data);
            const { raffleId, ...updateFields } = data;

            const raffleRef = tenantCollection(context.tenantId, "raffles").doc(raffleId);
            const raffleDoc = await raffleRef.get();

            if (!raffleDoc.exists) {
                throw new AppError(
                    AppErrorCode.NOT_FOUND,
                    "Raffle not found."
                );
            }

            const currentStatus = raffleDoc.data()?.status as RaffleStatus;

            if (currentStatus === "finished" || currentStatus === "cancelled") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    `Cannot modify a raffle in "${currentStatus}" state.`
                );
            }

            // Build update object with only provided fields
            const updateData: Record<string, unknown> = {
                updatedAt: FieldValue.serverTimestamp(),
            };

            for (const [key, value] of Object.entries(updateFields)) {
                if (value !== undefined) {
                    updateData[key] = value;
                }
            }

            await raffleRef.update(updateData);

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Transitions a raffle's state following the valid state machine.
 * Admin-only.
 * Valid transitions: draft→active, draft→cancelled, active→finished, active→cancelled
 */
export const transitionRaffleState = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(transitionRaffleStateSchema, request.data);

            const raffleRef = tenantCollection(context.tenantId, "raffles").doc(data.raffleId);
            const raffleDoc = await raffleRef.get();

            if (!raffleDoc.exists) {
                throw new AppError(
                    AppErrorCode.NOT_FOUND,
                    "Raffle not found."
                );
            }

            const currentStatus = raffleDoc.data()?.status as RaffleStatus;
            const allowedTargets = VALID_TRANSITIONS[currentStatus];

            if (!allowedTargets.includes(data.targetState)) {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    `Transition from ${currentStatus} to ${data.targetState} is not allowed`
                );
            }

            await raffleRef.update({
                status: data.targetState,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Audit trail
            await createAuditEntry(context.tenantId, "raffle_status_changed", "raffle", data.raffleId, context.uid, null, {
                from: currentStatus, to: data.targetState,
            });

            return { success: true, newStatus: data.targetState };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Sets the winning number on a finished raffle.
 * Admin-only. Raffle must be in "finished" state.
 * If a ticket matches the winning number, marks it as "winner".
 */
export const setWinningNumber = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(setWinningNumberSchema, request.data);

            const raffleRef = tenantCollection(context.tenantId, "raffles").doc(data.raffleId);
            const raffleDoc = await raffleRef.get();

            if (!raffleDoc.exists) {
                throw new AppError(
                    AppErrorCode.NOT_FOUND,
                    "Raffle not found."
                );
            }

            const currentStatus = raffleDoc.data()?.status as RaffleStatus;

            if (currentStatus !== "finished") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Winning number can only be set on a finished raffle."
                );
            }

            // Update the winning number on the raffle document
            await raffleRef.update({
                winningNumber: data.winningNumber,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Query for the ticket with the winning number
            // Check both single-number tickets and multi-number tickets
            const ticketsRef = raffleRef.collection("tickets");
            const ticketQuery = await ticketsRef
                .where("numbers", "array-contains", data.winningNumber)
                .limit(1)
                .get();

            if (ticketQuery.empty) {
                return { winner: null, message: "Ninguna boleta coincide con el número ganador" };
            }

            // Mark the winning ticket
            const winningTicketDoc = ticketQuery.docs[0];
            await winningTicketDoc.ref.update({
                status: "winner",
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Audit trail
            await createAuditEntry(context.tenantId, "winning_number_set", "raffle", data.raffleId, context.uid, null, {
                winningNumber: data.winningNumber, winnerTicket: winningTicketDoc.id,
            });

            return { winner: winningTicketDoc.id };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Borra en lotes todos los documentos que devuelve una query, respetando
 * el límite de operaciones por batch de Firestore.
 */
async function deleteQueryInBatches(query: FirebaseFirestore.Query): Promise<number> {
    const db = getDb();
    let deleted = 0;
    // Se procesa en páginas para no cargar todo en memoria.
    // Cada página se borra en batches de BATCH_SIZE.
    // Repetir hasta que no queden documentos.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const snap = await query.limit(BATCH_SIZE).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < BATCH_SIZE) break;
    }
    return deleted;
}

/**
 * Elimina una rifa y TODO lo asociado a ella:
 * - la subcolección de boletas (tickets) de la rifa
 * - los pagos, comisiones y ajustes del tenant que pertenezcan a esa rifa
 * - el documento de la rifa
 * NO elimina clientes, vendedores ni usuarios (cajeros/admin): esos se conservan.
 * Admin-only.
 */
export const deleteRaffle = onCall(
    { region: "us-central1", timeoutSeconds: 540 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const { raffleId } = validateData(deleteRaffleSchema, request.data);

            const db = getDb();
            const raffleRef = tenantCollection(context.tenantId, "raffles").doc(raffleId);
            const raffleSnap = await raffleRef.get();

            if (!raffleSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Rifa no encontrada.");
            }

            const raffleName = raffleSnap.data()?.name ?? "";

            // 1. Boletas de la rifa (subcolección)
            const ticketsDeleted = await deleteQueryInBatches(raffleRef.collection("tickets"));

            // 2. Pagos, comisiones y ajustes del tenant asociados a esta rifa
            const tenantPath = `tenants/${context.tenantId}`;
            const paymentsDeleted = await deleteQueryInBatches(
                db.collection(`${tenantPath}/payments`).where("raffleId", "==", raffleId)
            );
            const commissionsDeleted = await deleteQueryInBatches(
                db.collection(`${tenantPath}/commissions`).where("raffleId", "==", raffleId)
            );
            const adjustmentsDeleted = await deleteQueryInBatches(
                db.collection(`${tenantPath}/adjustments`).where("raffleId", "==", raffleId)
            );

            // 3. El documento de la rifa
            await raffleRef.delete();

            // Audit trail
            await createAuditEntry(context.tenantId, "raffle_deleted", "raffle", raffleId, context.uid, null, {
                name: raffleName, ticketsDeleted, paymentsDeleted, commissionsDeleted, adjustmentsDeleted,
            });

            return { success: true, ticketsDeleted, paymentsDeleted, commissionsDeleted, adjustmentsDeleted };
        } catch (error) {
            handleError(error);
        }
    }
);
