/**
 * Import Service - Importación masiva de boletas/abonos desde un Excel plano.
 *
 * El admin sube un Excel con una fila por boleta y columnas:
 *   vendedor, numero, nombre_cliente, cedula, celular, abono
 * El front lo parsea (librería xlsx) y envía las filas ya estructuradas a este
 * callable. Aquí se procesa de forma IDEMPOTENTE contra la rifa OFICIAL:
 *
 *  - Vendedor: se busca por nombre (case-insensitive). Si no existe, se crea con
 *    una cédula placeholder única (IMP-<n>) que el admin puede corregir luego.
 *  - Cliente: si la fila trae nombre, se busca por cédula. Si no existe, se crea.
 *    Si no trae cédula, el front ya debió resolver un placeholder antes de enviar.
 *  - Boleta: se asigna el vendedor (y el cliente si lo hay).
 *  - Abono: el "abono" del Excel es el TOTAL abonado de esa boleta. Se registra
 *    solo la DIFERENCIA respecto de lo ya abonado (value - pendingBalance), así
 *    reejecutar la importación no duplica pagos.
 *
 * Se respeta el bloqueo por sorteo (8pm del día del sorteo) y la regla de rifa
 * oficial. Devuelve un resumen por fila para que el front muestre el resultado.
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { AppError, AppErrorCode, handleError } from "../utils/errors";
import { getDb, getOfficialRaffleId } from "../utils/firestore";
import { computeTicketStatus } from "../utils/ticket-status";
import { resolveTicketRef } from "../utils/ticket-resolve";
import { assertRaffleNotLockedById } from "../utils/raffle-lock";
import { createAuditEntry } from "./audit.service";

// --- Schema ---

const importRowSchema = z.object({
    // Índice de la fila en el Excel (1-based, sin contar cabecera) para reportar.
    row: z.number().int().min(1),
    vendor: z.string().min(1).max(100),
    number: z.number().int().min(0).max(9999),
    customerName: z.string().max(100).optional().default(""),
    customerDocument: z.string().max(30).optional().default(""),
    customerPhone: z.string().max(20).optional().default(""),
    // Total abonado de la boleta (ya sumado en el Excel). 0 = sin abono.
    deposit: z.number().int().min(0).default(0),
});

const importDataSchema = z.object({
    raffleId: z.string().min(1),
    rows: z.array(importRowSchema).min(1).max(6000),
});

type ImportRow = z.infer<typeof importRowSchema>;

interface RowResult {
    row: number;
    number: number;
    status: "ok" | "error";
    // Acciones aplicadas (para el resumen legible en el front).
    vendorCreated?: boolean;
    customerCreated?: boolean;
    depositApplied?: number;
    // true si esta fila cambió ALGO (creó vendedor/cliente, aplicó abono o cambió
    // el cliente de la boleta). false si ya estaba al día (reimportación sin efecto).
    changed?: boolean;
    message?: string;
}

// --- Helpers de normalización ---

function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// --- Callable ---

/**
 * Importa filas de boletas/abonos a la rifa oficial. Admin-only.
 */
export const importRaffleData = onCall(
    { region: "us-central1", timeoutSeconds: 540, memory: "512MiB" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(importDataSchema, request.data);
            const { raffleId, rows } = data;

            // Solo la rifa oficial (la actual). Evita cargar en una rifa anterior.
            const officialId = await getOfficialRaffleId(context.tenantId);
            if (officialId !== raffleId) {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Solo puedes importar en la rifa actual."
                );
            }
            // Bloqueo por sorteo: tras las 8pm del día del sorteo nadie opera.
            await assertRaffleNotLockedById(context.tenantId, raffleId);

            const db = getDb();
            const vendorsCol = db.collection(`tenants/${context.tenantId}/vendors`);
            const customersCol = db.collection(`tenants/${context.tenantId}/customers`);

            // --- Cachés en memoria para no releer en cada fila ---
            // Vendedores por nombre normalizado -> vendorId.
            const vendorByName = new Map<string, string>();
            {
                const snap = await vendorsCol.get();
                snap.docs.forEach((d) => {
                    const n = normalizeName((d.data().name as string) || "");
                    if (n && !vendorByName.has(n)) vendorByName.set(n, d.id);
                });
            }
            // Clientes por cédula -> customerId.
            const customerByDoc = new Map<string, string>();
            {
                const snap = await customersCol.get();
                snap.docs.forEach((d) => {
                    const doc = String(d.data().document || "").trim();
                    if (doc && !customerByDoc.has(doc)) customerByDoc.set(doc, d.id);
                });
            }

            // Contador para cédulas placeholder de vendedores nuevos (IMP-<n>).
            // Arranca contando placeholders existentes para no chocar.
            let placeholderSeq = 0;
            for (const id of vendorByName.values()) void id;
            {
                const existing = await vendorsCol
                    .where("document", ">=", "IMP-")
                    .where("document", "<", "IMP.")
                    .get();
                placeholderSeq = existing.size;
            }

            const results: RowResult[] = [];
            let okCount = 0;
            let errorCount = 0;
            let changedCount = 0;   // filas que aplicaron algún cambio
            let unchangedCount = 0; // filas que ya estaban al día (reimportación sin efecto)

            // --- Procesar fila por fila ---
            for (const r of rows as ImportRow[]) {
                try {
                    const result = await processRow(
                        context,
                        db,
                        raffleId,
                        r,
                        vendorByName,
                        customerByDoc,
                        () => `IMP-${String(++placeholderSeq).padStart(4, "0")}`
                    );
                    results.push(result);
                    if (result.status === "ok") {
                        okCount++;
                        if (result.changed) changedCount++;
                        else unchangedCount++;
                    } else {
                        errorCount++;
                    }
                } catch (err) {
                    errorCount++;
                    results.push({
                        row: r.row,
                        number: r.number,
                        status: "error",
                        message: err instanceof Error ? err.message : "Error inesperado en la fila.",
                    });
                }
            }

            // Auditoría global de la importación.
            await createAuditEntry(
                context.tenantId,
                "data_imported",
                "raffle",
                raffleId,
                context.uid,
                null,
                { total: rows.length, ok: okCount, errors: errorCount, changed: changedCount, unchanged: unchangedCount }
            );

            return {
                total: rows.length,
                ok: okCount,
                errors: errorCount,
                changed: changedCount,
                unchanged: unchangedCount,
                results,
            };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Procesa una fila: upsert vendedor, asigna boleta, upsert cliente y aplica el
 * abono faltante. Devuelve el resultado de la fila.
 */
async function processRow(
    context: AuthContext,
    db: FirebaseFirestore.Firestore,
    raffleId: string,
    r: ImportRow,
    vendorByName: Map<string, string>,
    customerByDoc: Map<string, string>,
    nextPlaceholderDoc: () => string
): Promise<RowResult> {
    let vendorCreated = false;
    let customerCreated = false;

    // 1) Vendedor (upsert por nombre normalizado).
    const vKey = normalizeName(r.vendor);
    let vendorId = vendorByName.get(vKey);
    if (!vendorId) {
        const ref = db.collection(`tenants/${context.tenantId}/vendors`).doc();
        await ref.set({
            name: r.vendor.trim(),
            document: nextPlaceholderDoc(),
            phone: "",
            whatsapp: "",
            userId: "",
            status: "active",
            importedPlaceholder: true, // marca: cédula temporal por importar
            createdBy: context.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        vendorId = ref.id;
        vendorByName.set(vKey, vendorId);
        vendorCreated = true;
    }

    // 2) Cliente (upsert por cédula) — solo si la fila trae nombre.
    let customerId: string | null = null;
    const custName = r.customerName.trim();
    const custDoc = r.customerDocument.trim();
    if (custName) {
        if (!custDoc) {
            // El front debió resolver un placeholder de cédula. Si llega vacío,
            // no bloqueamos la boleta: se asigna sin cliente y se avisa.
            return finalizeWithoutClient();
        }
        customerId = customerByDoc.get(custDoc) ?? null;
        if (!customerId) {
            const ref = db.collection(`tenants/${context.tenantId}/customers`).doc();
            await ref.set({
                name: custName,
                document: custDoc,
                phone: r.customerPhone.trim(),
                whatsapp: "",
                address: "",
                city: "",
                createdBy: context.uid,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            customerId = ref.id;
            customerByDoc.set(custDoc, customerId);
            customerCreated = true;
        }
    }

    return await assignAndDeposit(customerId);

    // --- cierres internos que comparten vendorId/flags ---

    async function finalizeWithoutClient(): Promise<RowResult> {
        const res = await assignAndDeposit(null);
        if (res.status === "ok") {
            res.message = "Cliente sin cédula: boleta asignada sin cliente.";
        }
        return res;
    }

    async function assignAndDeposit(clientId: string | null): Promise<RowResult> {
        const ticketRef = await resolveTicketRef(context.tenantId, raffleId, r.number);
        if (!ticketRef) {
            return {
                row: r.row,
                number: r.number,
                status: "error",
                message: `La boleta #${r.number} no existe en esta rifa.`,
            };
        }

        // Transacción: asigna vendedor/cliente y calcula el abono faltante.
        const txResult = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ticketRef);
            if (!snap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, `La boleta #${r.number} no existe.`);
            }
            const ticket = snap.data()!;

            if (ticket.status === "cancelled") {
                throw new AppError(AppErrorCode.INVALID_TRANSITION, `La boleta #${r.number} está cancelada.`);
            }

            const value: number = ticket.value ?? 0;
            const currentPending: number = ticket.pendingBalance ?? value;
            const alreadyPaid = value - currentPending;

            // Abono a aplicar = diferencia entre el total del Excel y lo ya abonado.
            // Nunca negativo, nunca por encima del saldo pendiente (idempotente).
            let depositToApply = 0;
            if (r.deposit > alreadyPaid) {
                depositToApply = Math.min(r.deposit - alreadyPaid, currentPending);
            }

            const newPending = currentPending - depositToApply;

            // Cliente final: el de la fila si lo hay; si no, conserva el existente.
            const finalCustomerId = clientId ?? ticket.customerId ?? null;

            const newStatus = computeTicketStatus({
                ...ticket,
                vendorId,
                customerId: finalCustomerId,
                pendingBalance: newPending,
            });

            const updates: Record<string, unknown> = {
                vendorId,
                status: newStatus,
                pendingBalance: newPending,
                updatedAt: FieldValue.serverTimestamp(),
            };
            const customerChanged = finalCustomerId !== (ticket.customerId ?? null);
            const vendorChanged = vendorId !== (ticket.vendorId ?? null);
            if (customerChanged) {
                updates.customerId = finalCustomerId;
            }
            tx.update(ticketRef, updates);

            // Registrar el pago SOLO si hay abono nuevo. El trigger onPaymentCreated
            // generará la comisión automáticamente si la boleta queda en saldo 0.
            if (depositToApply > 0) {
                const paymentRef = db.collection(`tenants/${context.tenantId}/payments`).doc();
                tx.set(paymentRef, {
                    ticketId: ticketRef.id,
                    raffleId,
                    customerId: finalCustomerId,
                    vendorId,
                    amount: depositToApply,
                    type: "installment",
                    method: "cash",
                    date: FieldValue.serverTimestamp(),
                    observations: "Importación masiva",
                    source: "import",
                    createdAt: FieldValue.serverTimestamp(),
                    createdBy: context.uid,
                });
            }

            return { depositToApply, customerChanged, vendorChanged };
        });

        // La fila "cambió algo" si creó vendedor/cliente, aplicó un abono nuevo,
        // o cambió el vendedor/cliente de la boleta. Si nada de eso, ya estaba al día.
        const changed =
            vendorCreated ||
            customerCreated ||
            txResult.depositToApply > 0 ||
            txResult.customerChanged ||
            txResult.vendorChanged;

        return {
            row: r.row,
            number: r.number,
            status: "ok",
            vendorCreated,
            customerCreated,
            depositApplied: txResult.depositToApply,
            changed,
        };
    }
}
