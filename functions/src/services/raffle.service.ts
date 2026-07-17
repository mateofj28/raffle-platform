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
import { tenantCollection } from "../utils/firestore";
import type { RaffleStatus } from "../types/index";

// --- Schemas ---

const createRaffleSchema = z.object({
    name: z.string().min(1).max(150),
    description: z.string().min(1).max(1000),
    prize: z.string().min(1).max(200),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    drawDate: z.string().min(1),
    lottery: z.string().min(1),
    ticketPrice: z.number().int().positive(),
    totalTickets: z.number().int().min(1).max(50000),
});

const updateRaffleSchema = z.object({
    raffleId: z.string().min(1),
    name: z.string().min(1).max(150).optional(),
    description: z.string().min(1).max(1000).optional(),
    prize: z.string().min(1).max(200).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    drawDate: z.string().min(1).optional(),
    lottery: z.string().min(1).optional(),
    ticketPrice: z.number().int().positive().optional(),
    totalTickets: z.number().int().min(1).max(50000).optional(),
});

const transitionRaffleStateSchema = z.object({
    raffleId: z.string().min(1),
    targetState: z.enum(["active", "finished", "cancelled"]),
});

const setWinningNumberSchema = z.object({
    raffleId: z.string().min(1),
    winningNumber: z.number().int().positive(),
});

// --- Valid Transitions ---

const VALID_TRANSITIONS: Record<RaffleStatus, RaffleStatus[]> = {
    draft: ["active", "cancelled"],
    active: ["finished", "cancelled"],
    finished: [],
    cancelled: [],
};

// --- Callable Functions ---

/**
 * Creates a new raffle in Draft state.
 * Admin-only.
 */
export const createRaffle = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(createRaffleSchema, request.data);

            const rafflesRef = tenantCollection(context.tenantId, "raffles");
            const newRaffleRef = rafflesRef.doc();
            const raffleId = newRaffleRef.id;

            await newRaffleRef.set({
                id: raffleId,
                name: data.name,
                description: data.description,
                prize: data.prize,
                startDate: data.startDate,
                endDate: data.endDate,
                drawDate: data.drawDate,
                lottery: data.lottery,
                ticketPrice: data.ticketPrice,
                totalTickets: data.totalTickets,
                status: "draft" as RaffleStatus,
                winningNumber: null,
                imageUrl: "",
                createdBy: context.uid,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
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
    { region: "us-central1" },
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
    { region: "us-central1" },
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
    { region: "us-central1" },
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
            const ticketsRef = raffleRef.collection("tickets");
            const ticketQuery = await ticketsRef
                .where("number", "==", data.winningNumber)
                .limit(1)
                .get();

            if (ticketQuery.empty) {
                return { winner: null, message: "No ticket matches the winning number" };
            }

            // Mark the winning ticket
            const winningTicketDoc = ticketQuery.docs[0];
            await winningTicketDoc.ref.update({
                status: "winner",
                updatedAt: FieldValue.serverTimestamp(),
            });

            return { winner: winningTicketDoc.id };
        } catch (error) {
            handleError(error);
        }
    }
);
