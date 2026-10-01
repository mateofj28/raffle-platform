"use client";

import { useState } from "react";
import { Button, Card, CardContent, toast } from "@heroui/react";
import { Ticket, Plus, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatTicketNumbers } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, where, limit } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { callFunction } from "@/services/firebase-callable";

interface AddedTicket {
    number: number;      // número base (min de la pareja) que identifica la boleta
    label: string;       // etiqueta para mostrar (pareja o número simple)
}

interface TicketDoc {
    id: string;
    number: number;
    numbers?: number[];
    status?: string;
    vendorId?: string | null;
    customerId?: string | null;
}

interface AssignResult {
    assigned: number;
    skipped: number;
    results: { number: number; status: "ok" | "skipped"; reason?: string }[];
}

interface AddTicketsToCustomerProps {
    customerId: string;
    customerName: string;
    /** Se llama al terminar (ej. para redirigir o resetear). */
    onDone?: () => void;
}

function padTicketNumber(num: number): string {
    return String(num).padStart(4, "0");
}

/**
 * Panel para agregar (vender) boletas a un cliente. Valida CADA boleta en vivo
 * contra Firestore al agregarla: debe existir, tener vendedor y estar libre de
 * cliente. Al confirmar, llama assignTicketsToCustomer (venta en lote, sin pagos).
 */
export function AddTicketsToCustomer({ customerId, customerName, onDone }: AddTicketsToCustomerProps) {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { activeRaffle } = useRaffleStore();

    const [input, setInput] = useState("");
    const [list, setList] = useState<AddedTicket[]>([]);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState<AssignResult | null>(null);

    // Lee la boleta que contiene `num` en la rifa activa (resuelve 1 y 2 números).
    const findTicket = async (num: number) => {
        if (!tenantId || !activeRaffle) return null;
        const base = `raffles/${activeRaffle.id}/tickets`;
        // 1) Acceso directo por docId (número de 4 dígitos; cubre 1 número y el menor de la pareja).
        const directRef = doc(getDb(), "tenants", tenantId, "raffles", activeRaffle.id, "tickets", padTicketNumber(num));
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
            const data = directSnap.data();
            const numbers: number[] = Array.isArray(data.numbers) ? data.numbers : [data.number];
            if (numbers.includes(num)) return { id: directSnap.id, ...data } as unknown as TicketDoc;
        }
        // 2) Búsqueda por el array de números (segundo número de la pareja).
        const q = query(tenantCollection(tenantId, base), where("numbers", "array-contains", num), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const d = snap.docs[0];
            return { id: d.id, ...d.data() } as unknown as TicketDoc;
        }
        return null;
    };

    const handleAdd = async () => {
        setError(null);
        const num = parseInt(input, 10);
        if (Number.isNaN(num) || num < 0 || num > 9999) {
            setError("Ingresa un número de boleta válido (0-9999).");
            return;
        }
        if (!activeRaffle) { setError("No hay rifa activa."); return; }

        setChecking(true);
        try {
            const ticket = await findTicket(num);
            if (!ticket) { setError(`La boleta ${formatTicketNumbers([num])} no existe en esta rifa.`); return; }

            const baseNumber = ticket.number as number;
            const label = formatTicketNumbers(ticket.numbers as number[] | undefined, baseNumber);

            // Validaciones en vivo.
            if (ticket.status === "cancelled") { setError(`La boleta ${label} está cancelada.`); return; }
            if (!ticket.vendorId) { setError(`La boleta ${label} no tiene vendedor asignado. Primero debe asignarse a un vendedor.`); return; }
            if (ticket.customerId === customerId) { setError(`La boleta ${label} ya es de este cliente.`); return; }
            if (ticket.customerId) { setError(`La boleta ${label} ya es de otro cliente.`); return; }

            // Evitar duplicados en la lista (misma boleta base).
            if (list.some((t) => t.number === baseNumber)) { setError(`La boleta ${label} ya está en la lista.`); return; }

            setList((prev) => [...prev, { number: baseNumber, label }]);
            setInput("");
        } catch (e) {
            console.error(e);
            setError("No se pudo validar la boleta. Intenta de nuevo.");
        } finally {
            setChecking(false);
        }
    };

    const removeFromList = (number: number) => setList((prev) => prev.filter((t) => t.number !== number));

    const handleConfirm = async () => {
        if (!activeRaffle || list.length === 0) return;
        setConfirming(true);
        setError(null);
        try {
            const res = await callFunction<AssignResult>("assignTicketsToCustomer", {
                raffleId: activeRaffle.id,
                customerId,
                ticketNumbers: list.map((t) => t.number),
            });
            setResult(res);
            if (res.assigned > 0) {
                toast.success(`${res.assigned} boleta(s) agregada(s) a ${customerName}.`);
            }
            if (res.skipped > 0 && res.assigned === 0) {
                toast.danger(`No se agregó ninguna boleta. Revisa el detalle.`);
            }
            setList([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudieron agregar las boletas.");
        } finally {
            setConfirming(false);
        }
    };

    return (
        <Card>
            <CardContent className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-1 flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" /> Agregar boletas a {customerName}
                </h3>
                <p className="text-xs text-default-500 mb-4">
                    Escribe el número de boleta y pulsa Agregar. Se valida que exista, tenga vendedor y esté libre.
                </p>

                {/* Entrada + agregar */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="Ej: 0055"
                        value={input}
                        onChange={(e) => { setInput(e.target.value.replace(/\D/g, "")); setError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                        inputMode="numeric"
                        maxLength={4}
                        className="w-full sm:w-48"
                        disabled={confirming}
                    />
                    <Button variant="outline" onPress={handleAdd} isDisabled={checking || confirming || !input}>
                        {checking ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</> : <><Plus className="h-4 w-4" /> Agregar</>}
                    </Button>
                </div>
                {error && <p className="text-sm text-danger mt-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}

                {/* Lista de boletas por agregar */}
                {list.length > 0 && (
                    <div className="mt-4">
                        <p className="text-xs text-default-500 mb-2">{list.length} boleta(s) lista(s) para agregar:</p>
                        <div className="flex flex-wrap gap-2">
                            {list.map((t) => (
                                <span key={t.number} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-mono">
                                    {t.label}
                                    <button type="button" onClick={() => removeFromList(t.number)} aria-label={`Quitar ${t.label}`} className="hover:text-danger">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                            <Button variant="primary" onPress={handleConfirm} isDisabled={confirming}>
                                {confirming ? <><Loader2 className="h-4 w-4 animate-spin" /> Agregando…</> : <><CheckCircle2 className="h-4 w-4" /> Agregar {list.length} boleta(s)</>}
                            </Button>
                            <Button variant="ghost" onPress={() => setList([])} isDisabled={confirming}>Limpiar</Button>
                        </div>
                    </div>
                )}

                {/* Resumen tras confirmar */}
                {result && (
                    <div className="mt-5 border-t border-default-100 pt-4">
                        <div className="flex flex-wrap gap-3 text-sm mb-3">
                            <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1">{result.assigned} agregada(s)</span>
                            {result.skipped > 0 && <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1">{result.skipped} omitida(s)</span>}
                        </div>
                        {result.results.filter((r) => r.status === "skipped").length > 0 && (
                            <ul className="text-xs text-default-500 space-y-1">
                                {result.results.filter((r) => r.status === "skipped").map((r, i) => (
                                    <li key={i}>Boleta {r.number >= 0 ? formatTicketNumbers([r.number]) : "?"}: {r.reason}</li>
                                ))}
                            </ul>
                        )}
                        {onDone && (
                            <div className="mt-4">
                                <Button variant="outline" size="sm" onPress={onDone}>Finalizar</Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
