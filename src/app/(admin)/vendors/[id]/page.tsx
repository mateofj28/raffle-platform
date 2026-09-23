"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip, AlertDialog, Tooltip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem, toast } from "@heroui/react";
import { ArrowLeft, User, Phone, Hash, Ticket, UserMinus, ShoppingCart, DollarSign, Pencil, ChevronDown, X, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatTicketNumber, formatTicketNumbers } from "@/utils/formatters";
import { deriveTicketStatus } from "@/utils/ticket-status";
import { splitPayment, vendorCommission } from "@/utils/money";
import { isRaffleDrawLocked } from "@/utils/raffle-lock";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { ticketService } from "@/features/raffles/services/ticket.service";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Vendor, Ticket as TicketType } from "@/types/api.types";

interface TicketWithCustomer extends TicketType {
    customerName?: string;
}

// --- Main Page ---

export default function VendorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const vendorId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const userRole = useAuthStore((s) => s.user?.role);
    const { activeRaffle } = useRaffleStore();

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [tickets, setTickets] = useState<TicketWithCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    // Payment panel
    const [showPaymentPanel, setShowPaymentPanel] = useState(false);
    const [payTicketInput, setPayTicketInput] = useState("");
    const [payAmountInput, setPayAmountInput] = useState("");
    const [payMethodInput, setPayMethodInput] = useState("cash");
    const [paymentList, setPaymentList] = useState<{ ticketNumber: number; amount: number; method: string }[]>([]);
    const [payError, setPayError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [editingPayIndex, setEditingPayIndex] = useState<number | null>(null);
    const [editingPayValue, setEditingPayValue] = useState("");
    const [editingPayMethod, setEditingPayMethod] = useState("cash");

    // Ref al panel de registrar pago para hacer scroll automático al abrirlo
    const paymentPanelRef = useRef<HTMLDivElement>(null);
    // Ref al campo de número de boleta para devolver el foco tras agregar un pago
    const payTicketInputRef = useRef<HTMLInputElement>(null);

    // Al abrir el panel de pago, desplaza la vista hasta el formulario para
    // que el usuario vea de inmediato la acción que debe realizar.
    useEffect(() => {
        if (!showPaymentPanel) return;
        const id = requestAnimationFrame(() => {
            paymentPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return () => cancelAnimationFrame(id);
    }, [showPaymentPanel]);

    useEffect(() => {
        if (!activeRaffle) router.push("/raffles");
    }, [activeRaffle, router]);

    useEffect(() => {
        if (!tenantId || !vendorId) return;
        const load = async () => {
            try {
                const vendorDoc = await getDoc(doc(getDb(), "tenants", tenantId, "vendors", vendorId));
                if (vendorDoc.exists()) setVendor({ id: vendorDoc.id, ...vendorDoc.data() } as Vendor);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
    };
      load();
  }, [tenantId, vendorId]);

    useEffect(() => {
        if (!tenantId || !vendorId || !activeRaffle) return;
        const load = async () => {
            setTicketsLoading(true);
            try {
                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                const customersMap = new Map<string, string>();
                customersSnap.docs.forEach(d => {
                    customersMap.set(d.id, d.data().name);
                });

                const ticketsCol = tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`);
                const q = query(ticketsCol, where("vendorId", "==", vendorId), orderBy("number", "asc"));
                const ticketsSnap = await getDocs(q);

                setTickets(ticketsSnap.docs.map(d => {
                    const data = d.data() as TicketType;
                    return { ...data, customerName: data.customerId ? customersMap.get(data.customerId) || data.customerId : undefined };
                }));
            } catch (e) { console.error(e); }
            finally { setTicketsLoading(false); }
        };
        load();
    }, [tenantId, vendorId, activeRaffle, reloadKey]);


    if (!activeRaffle) return null;
    if (loading) return <div><PageHeader title="Vendedor" /><LoadingSkeleton rows={6} /></div>;
    if (!vendor) return <div><PageHeader title="Vendedor no encontrado" /></div>;

    const assigned = tickets.filter(t => deriveTicketStatus(t) === "assigned").length;
    const sold = tickets.filter(t => deriveTicketStatus(t) === "sold").length;
    const installment = tickets.filter(t => deriveTicketStatus(t) === "installment").length;

    // Financial metrics
    const paidTickets = tickets.filter(t => deriveTicketStatus(t) === "sold");
    const installmentTickets = tickets.filter(t => deriveTicketStatus(t) === "installment");

    const totalAbonado = tickets.reduce((sum, t) => sum + (t.value - t.pendingBalance), 0);
    const recaudadoPagadas = paidTickets.reduce((sum, t) => sum + t.value, 0);
    const recaudadoAbonadas = installmentTickets.reduce((sum, t) => sum + (t.value - t.pendingBalance), 0);
    const commission = vendorCommission(totalAbonado);

    // Payment panel handlers
    const handleAddPayment = () => {
        const num = parseInt(payTicketInput);
        const amount = parseInt(payAmountInput.replace(/\D/g, "") || "0");
        if (Number.isNaN(num) || num < 0 || num > 9999) { setPayError("Ingresa un número de boleta válido"); return; }
        if (amount < 5000) { setPayError("El monto mínimo es $5.000"); return; }

        // Buscar la boleta que CONTIENE ese número (en rifas de 2 números la
        // boleta juega una pareja; cualquiera de los dos números la identifica).
        const ticket = tickets.find(t => (t.numbers ?? [t.number]).includes(num));
        if (!ticket) { setPayError(`El número ${formatTicketNumber(num)} no pertenece a este vendedor`); return; }
        const pairLabel = formatTicketNumbers(ticket.numbers, ticket.number);
        if (ticket.pendingBalance <= 0) { setPayError(`La boleta ${pairLabel} ya está completamente pagada`); return; }

        // La boleta se identifica por su número base (min de la pareja): abonar por
        // cualquiera de sus dos números abona la MISMA boleta. Se consolida por ahí.
        const baseNumber = ticket.number;

        // Considerar lo ya agregado en la lista para esta misma boleta al validar el saldo
        const alreadyForTicket = paymentList
            .filter(p => p.ticketNumber === baseNumber)
            .reduce((sum, p) => sum + p.amount, 0);
        if (alreadyForTicket + amount > ticket.pendingBalance) {
            setPayError(`Máximo para la boleta ${pairLabel}: ${formatCurrency(ticket.pendingBalance - alreadyForTicket)}`);
            return;
        }

        // Consolidar: si ya hay una entrada con la misma boleta Y el mismo método, sumar el monto
        setPaymentList(prev => {
            const idx = prev.findIndex(p => p.ticketNumber === baseNumber && p.method === payMethodInput);
            if (idx !== -1) {
                return prev.map((p, i) => i === idx ? { ...p, amount: p.amount + amount } : p);
            }
            return [...prev, { ticketNumber: baseNumber, amount, method: payMethodInput }];
        });
        setPayTicketInput("");
        setPayAmountInput("");
        setPayError(null);
        // Devolver el foco al campo de boleta para seguir ingresando sin usar el mouse
        payTicketInputRef.current?.focus();
    };

    // Permite agregar el pago presionando Enter desde los campos Boleta o Monto,
    // sin tener que tabular hasta el botón "Agregar".
    const handlePayFieldEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const canAdd = payTicketInput && payAmountInput && parseInt(payAmountInput || "0", 10) >= 5000;
        if (canAdd) handleAddPayment();
    };

    const handleRemovePayment = (index: number) => setPaymentList(prev => prev.filter((_, i) => i !== index));

    const handleConfirmPayments = async () => {
        if (paymentList.length === 0) return;
        setProcessing(true);
        setPayError(null);
        try {
            for (const p of paymentList) {
                try {
                    await callFunction("registerPayment", {
                        raffleId: activeRaffle!.id,
                        ticketNumber: p.ticketNumber,
                        amount: p.amount,
                        type: p.amount >= (tickets.find(t => t.number === p.ticketNumber)?.pendingBalance || 0) ? "payment" : "installment",
                        method: p.method,
                        observations: "",
                    });
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    const t = tickets.find(tt => tt.number === p.ticketNumber);
                    setPayError(`Error en la boleta ${formatTicketNumbers(t?.numbers, p.ticketNumber)}: ${msg}`);
                    setProcessing(false);
                    return;
                }
            }
            toast.success(`${paymentList.length} pago(s) registrado(s)`);
            setPaymentList([]);
            setShowPaymentPanel(false);
            setReloadKey(k => k + 1);
        } catch (e) {
            setPayError(e instanceof Error ? e.message : "Error al registrar pagos");
        } finally { setProcessing(false); }
    };

    // ¿La rifa está cerrada por el sorteo (después de las 8pm del día del sorteo)?
    const drawLocked = isRaffleDrawLocked(activeRaffle?.endDate);

    return (
      <div>
          <PageHeader
              title={vendor.name}
              description={`Boletas en "${activeRaffle.name}"`}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="primary" size="sm" isDisabled={drawLocked} onPress={() => setShowPaymentPanel(true)}>
                            <DollarSign className="h-4 w-4" /> Registrar pago
                        </Button>
                        <Link href={`/vendors/${vendorId}/edit`}>
                            <Button variant="outline" size="sm"><Pencil className="h-4 w-4" /> Editar</Button>
                        </Link>
                        <Link href="/vendors">
                            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                        </Link>
                    </div>
                }
          />

            {drawLocked && (
                <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
                    <span className="font-semibold">Rifa cerrada por el sorteo.</span>{" "}
                    El día del sorteo, a partir de las 8:00 p.m., no se permiten operaciones (asignar, desasignar, vender, abonar ni corregir). Esto garantiza la transparencia.
                </div>
            )}

          {/* Vendor info */}
      <Card className="mb-6">
              <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10"><User className="h-5 w-5 text-primary" /></div>
                          <div><p className="text-xs text-default-500">Nombre</p><p className="font-semibold text-sm">{vendor.name}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-warning/10"><Hash className="h-5 w-5 text-warning" /></div>
                          <div><p className="text-xs text-default-500">Documento</p><p className="font-semibold text-sm">{vendor.document}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10"><Phone className="h-5 w-5 text-success" /></div>
                          <div><p className="text-xs text-default-500">Teléfono</p><p className="font-semibold text-sm">{vendor.phone}</p></div>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Separator className="my-6" />

            {/* Payment Panel */}
            {showPaymentPanel && (
                <Card ref={paymentPanelRef} className="mb-6 border-2 border-emerald-500/50 scroll-mt-24">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold">Registrar pagos — {vendor.name}</h3>
                            <Button variant="ghost" size="sm" onPress={() => { setShowPaymentPanel(false); setPaymentList([]); setPayError(null); }}>
                                <X className="h-4 w-4" /> Cerrar
                            </Button>
                        </div>

                        <div className="flex items-end gap-3 flex-wrap mb-3">
                            <div>
                                <label className="text-xs font-medium mb-1 block">Número</label>
                                <Input ref={payTicketInputRef} placeholder="Ej: 0055" value={payTicketInput} onChange={(e) => setPayTicketInput(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={handlePayFieldEnter} inputMode="numeric" className="w-24" maxLength={4} />
                            </div>
                            {/* Pareja: al escribir un número muestra su compañero (rifas de 2 números). */}
                            {(() => {
                                if (!payTicketInput) return null;
                                const n = parseInt(payTicketInput);
                                if (Number.isNaN(n)) return null;
                                const t = tickets.find(tt => (tt.numbers ?? [tt.number]).includes(n));
                                // Solo tiene sentido mostrar "pareja" si la boleta juega 2+ números.
                                if (!t || (t.numbers?.length ?? 1) < 2) return null;
                                return (
                                    <div>
                                        <label className="text-xs font-medium mb-1 block">Pareja</label>
                                        <div className="h-10 px-3 flex items-center rounded-lg border border-teal-500/40 bg-teal-500/5 text-sm font-semibold font-mono">
                                            {formatTicketNumbers(t.numbers, t.number)}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div>
                                <label className="text-xs font-medium mb-1 block">Monto</label>
                                <Input placeholder="Ej: 30.000" value={payAmountInput ? parseInt(payAmountInput).toLocaleString("es-CO") : ""} onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); const num = parseInt(raw || "0"); if (num <= (activeRaffle?.ticketPrice || 999999)) setPayAmountInput(raw); }} onKeyDown={handlePayFieldEnter} inputMode="numeric" className="w-32" />
                            </div>
                            <div
                                onKeyDownCapture={(e) => {
                                    // Con el foco en el método, Enter debe EJECUTAR "Agregar",
                                    // no abrir el desplegable del select. Se intercepta en captura
                                    // para adelantarse al manejo interno del Select.
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const canAdd = payTicketInput && payAmountInput && parseInt(payAmountInput || "0", 10) >= 5000;
                                        if (canAdd) handleAddPayment();
                                    }
                                }}
                            >
                                <label className="text-xs font-medium mb-1 block">Método</label>
                                <Select aria-label="Método" selectedKey={payMethodInput} onSelectionChange={(key) => setPayMethodInput(String(key ?? "cash"))} className="w-40">
                                    <SelectTrigger className="w-full"><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                    <SelectPopover>
                                        <ListBox>
                                            <ListBoxItem id="cash" textValue="Efectivo">Efectivo</ListBoxItem>
                                            <ListBoxItem id="nequi" textValue="Nequi">Nequi</ListBoxItem>
                                            <ListBoxItem id="daviplata" textValue="Daviplata">Daviplata</ListBoxItem>
                                            <ListBoxItem id="transfer" textValue="Bancolombia">Bancolombia</ListBoxItem>
                                        </ListBox>
                                    </SelectPopover>
                                </Select>
                            </div>
                            <Button variant="outline" size="sm" onPress={handleAddPayment} isDisabled={!payTicketInput || !payAmountInput || parseInt(payAmountInput || "0", 10) < 5000}>Agregar</Button>
                        </div>

                        {payError && <div className="mb-3 p-2 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger">{payError}</div>}

                        {paymentList.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {paymentList.map((p, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-default-200 bg-white dark:bg-[#1A2F50]">
                                        <div className="flex items-center justify-center min-w-12 h-8 px-3 rounded-full bg-teal-100 dark:bg-teal-900/30 shrink-0">
                                            <span className="text-xs font-bold font-mono text-teal-600 dark:text-teal-400">{formatTicketNumbers(tickets.find(t => t.number === p.ticketNumber)?.numbers, p.ticketNumber)}</span>
                                        </div>
                                        <div className="flex-1">
                                            {editingPayIndex === i ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Input
                                                        value={editingPayValue ? parseInt(editingPayValue).toLocaleString("es-CO") : ""}
                                                        onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); if (parseInt(raw || "0") <= (activeRaffle?.ticketPrice || 999999)) setEditingPayValue(raw); }}
                                                        inputMode="numeric"
                                                        className="w-28"
                                                    />
                                                    <Select aria-label="Método" selectedKey={editingPayMethod} onSelectionChange={(key) => setEditingPayMethod(String(key ?? "cash"))} className="w-36">
                                                        <SelectTrigger className="w-full"><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                                        <SelectPopover>
                                                            <ListBox>
                                                                <ListBoxItem id="cash" textValue="Efectivo">Efectivo</ListBoxItem>
                                                                <ListBoxItem id="nequi" textValue="Nequi">Nequi</ListBoxItem>
                                                                <ListBoxItem id="daviplata" textValue="Daviplata">Daviplata</ListBoxItem>
                                                                <ListBoxItem id="transfer" textValue="Bancolombia">Bancolombia</ListBoxItem>
                                                            </ListBox>
                                                        </SelectPopover>
                                                    </Select>
                                                    <button onClick={() => { if (editingPayValue && parseInt(editingPayValue) >= 5000) { setPaymentList(prev => prev.map((item, idx) => idx === i ? { ...item, amount: parseInt(editingPayValue), method: editingPayMethod } : item)); setEditingPayIndex(null); } }} className="text-xs text-emerald-600 font-medium hover:underline">Guardar</button>
                                                    <button onClick={() => setEditingPayIndex(null)} className="text-xs text-default-400 hover:text-default-600">Cancelar</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-semibold text-emerald-500">{formatCurrency(p.amount)}</span>
                                                    <span className="text-xs text-default-500">{{ cash: "Efectivo", nequi: "Nequi", daviplata: "Daviplata", transfer: "Bancolombia" }[p.method]}</span>
                                                </div>
                                            )}
                                        </div>
                                        {editingPayIndex !== i && (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => { setEditingPayIndex(i); setEditingPayValue(String(p.amount)); setEditingPayMethod(p.method); }} className="p-1.5 rounded-md hover:bg-default-100 text-default-400 hover:text-amber-500 transition-colors">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => handleRemovePayment(i)} className="p-1.5 rounded-md hover:bg-default-100 text-default-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {/* En móvil se apila: totales arriba y botón a lo ancho abajo.
                                    En escritorio: totales a la izquierda y botón a la derecha. */}
                                <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-default-200 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                        {(() => {
                                            const total = paymentList.reduce((s, p) => s + p.amount, 0);
                                            const { cashier, commission } = splitPayment(total);
                                            return (
                                                <>
                                                    <p className="text-sm font-semibold">Total: <span className="text-emerald-500">{formatCurrency(total)}</span></p>
                                                    <p className="text-xs text-default-500">Recibe cajero (70%): <span className="font-medium">{formatCurrency(cashier)}</span></p>
                                                    <p className="text-xs text-default-500">Comisión vendedor (30%): <span className="font-medium text-amber-500">{formatCurrency(commission)}</span></p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <Button variant="primary" isDisabled={processing} onPress={handleConfirmPayments} className="w-full sm:w-auto">
                                        {processing ? "Procesando..." : `Confirmar ${paymentList.length} pago(s)`}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Ticket className="h-5 w-5" /> Boletas en esta rifa
          </h2>

          {ticketsLoading ? <LoadingSkeleton rows={5} /> : (
              <>
                  <div className="flex gap-2 flex-wrap mb-4">
                        <Chip size="sm" variant="soft" className="px-3 py-1">Total: {tickets.length}</Chip>
                        <Chip size="sm" variant="soft" color="warning" className="px-3 py-1">Asignadas: {assigned}</Chip>
                        <Chip size="sm" variant="soft" color="danger" className="px-3 py-1">Abonadas: {installment}</Chip>
                        <Chip size="sm" variant="soft" color="success" className="px-3 py-1">Vendidas: {sold}</Chip>
                    </div>

                    {/* Financial metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <div className="p-4 rounded-lg border border-default-200 bg-default-50">
                            <p className="text-xs text-default-500 mb-1">Total abonado</p>
                            <p className="text-lg font-bold">{formatCurrency(totalAbonado)}</p>
                        </div>
                        <div className="p-4 rounded-lg border border-success/20 bg-success/5">
                            <p className="text-xs text-default-500 mb-1">Recaudado (pagadas)</p>
                            <p className="text-lg font-bold text-success">{formatCurrency(recaudadoPagadas)}</p>
                        </div>
                        <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                            <p className="text-xs text-default-500 mb-1">Recaudado (abonadas)</p>
                            <p className="text-lg font-bold text-blue-500">{formatCurrency(recaudadoAbonadas)}</p>
                        </div>
                        <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                            <p className="text-xs text-default-500 mb-1">Comisión acumulada</p>
                            <p className="text-lg font-bold text-amber-500">{formatCurrency(commission)}</p>
                        </div>
                  </div>

                  {tickets.length === 0 ? (
                      <EmptyState title="Sin boletas" description="Este vendedor no tiene boletas en esta rifa" icon={<Ticket className="h-12 w-12" />} />
                  ) : (
                            <TicketsTableWithUnassign tickets={tickets} raffleId={activeRaffle.id} drawLocked={drawLocked} onReload={() => setReloadKey(k => k + 1)} onSell={(num) => router.push(`/sell/${num}`)} onPay={(num) => router.push(`/pay/${num}`)} onEditTicket={(num, action) => router.push(`/edit-ticket/${num}?action=${action}`)} onCorrectPayment={(num) => router.push(`/correct-payment/${num}`)} userRole={userRole} />
                  )}
              </>
          )}

      </div>
  );
}

// --- Table with unassign (SRP) ---

function TicketsTableWithUnassign({ tickets, raffleId, drawLocked = false, onReload, onSell, onPay, onEditTicket, onCorrectPayment, userRole }: { tickets: TicketWithCustomer[]; raffleId: string; drawLocked?: boolean; onReload: () => void; onSell: (ticketNum: number) => void; onPay: (ticketNum: number) => void; onEditTicket: (ticketNum: number, action: string) => void; onCorrectPayment: (ticketNum: number) => void; userRole?: string }) {
    const [confirmTicket, setConfirmTicket] = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const PAGE_SIZE = 20;

    const tenantId = useAuthStore((s) => s.user?.tenantId);
    // Número de boleta cuya acción se está verificando (para el spinner en su botón).
    const [verifyingNum, setVerifyingNum] = useState<number | null>(null);
    // Mensaje de problema detectado al verificar (abre el modal). null = sin problema.
    const [problem, setProblem] = useState<string | null>(null);

    /**
     * Antes de navegar a una pantalla de acción, RE-VERIFICA el estado real de la
     * boleta en Firestore (por si la pantalla tiene datos obsoletos). Si hay
     * problema, muestra un modal con el mensaje; si todo bien, ejecuta `go()`.
     * `action`: "client" (agregar/cambiar cliente) o "correct" (corregir abono).
     */
    const verifyThenGo = async (baseNumber: number, action: "client" | "unassign", go: () => void) => {
        if (!tenantId) { go(); return; }
        setVerifyingNum(baseNumber);
        try {
            const padded = String(baseNumber).padStart(4, "0");
            const snap = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", raffleId, "tickets", padded));
            if (!snap.exists()) {
                setProblem("La boleta ya no existe. Alguien pudo haberla modificado.");
                return;
            }
            const t = snap.data() as { vendorId?: string | null; customerId?: string | null; value?: number; pendingBalance?: number };
            const value = t.value ?? 0;
            const pending = t.pendingBalance ?? value;
            const paid = value - pending;

            if (action === "client") {
                // Para asignar/cambiar cliente la boleta debe tener vendedor.
                if (!t.vendorId) {
                    setProblem("La boleta ya no tiene vendedor asignado (alguien la liberó). Primero debe asignarse a un vendedor.");
                    return;
                }
            } else if (action === "unassign") {
                // Para desasignar: debe tener vendedor, sin cliente y sin abono.
                if (!t.vendorId) {
                    setProblem("La boleta ya no tiene vendedor asignado (alguien la liberó). No hay nada que desasignar.");
                    return;
                }
                if (t.customerId || paid > 0) {
                    setProblem("La boleta ya tiene cliente o abonos (alguien la cambió). No se puede desasignar.");
                    return;
                }
            }
            // Todo bien → continuar (navegar o abrir el modal de confirmación).
            go();
        } catch {
            setProblem("No se pudo verificar el estado de la boleta. Intenta de nuevo.");
        } finally {
            setVerifyingNum(null);
        }
    };

    // Filter tickets
    const filtered = tickets.filter(t => {
        if (statusFilter && deriveTicketStatus(t) !== statusFilter) return false;
        if (search) {
            const term = search.toLowerCase();
            // Coincide por CUALQUIERA de los números de la boleta (pareja incluida).
            const nums = t.numbers ?? [t.number];
            const matchesNumber = nums.some(n => String(n).includes(term) || formatTicketNumber(n).includes(term));
            const matchesName = t.customerName?.toLowerCase().includes(term);
            if (!matchesNumber && !matchesName) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedTickets = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleUnassign = async () => {
        if (confirmTicket === null) return;
        setUnassigning(true);
        try {
            const res = await ticketService.unassign(raffleId, [confirmTicket]) as { unassigned?: number; skipped?: number };
            setConfirmTicket(null);
            if ((res?.skipped ?? 0) > 0 && (res?.unassigned ?? 0) === 0) {
                // No se pudo liberar: alguien la cambió (abono/cliente) desde otra sesión.
                toast.warning("No se pudo liberar la boleta. Puede que alguien la haya cambiado. Refresca la pantalla.");
            } else if ((res?.unassigned ?? 0) > 0) {
                toast.success("Boleta liberada");
            }
            onReload();
        } catch (e) {
            console.error(e);
            toast.danger(e instanceof Error ? e.message : "No se pudo liberar la boleta");
        }
        finally { setUnassigning(false); }
    };

    return (
      <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <Input
                    placeholder="Buscar por # boleta o nombre de cliente..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full sm:w-96"
                />
                <Select
                    aria-label="Filtrar por estado"
                    selectedKey={statusFilter || null}
                    onSelectionChange={(key) => { setStatusFilter(key ? String(key) : ""); setPage(1); }}
                    placeholder="Todos los estados"
                    className="w-52"
                >
                    <SelectTrigger>
                        <SelectValue />
                        <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                    </SelectTrigger>
                    <SelectPopover>
                        <ListBox>
                            <ListBoxItem id="" textValue="Todos los estados">Todos los estados</ListBoxItem>
                            <ListBoxItem id="assigned" textValue="Asignada">Asignada</ListBoxItem>
                            <ListBoxItem id="installment" textValue="Abonada">Abonada</ListBoxItem>
                            <ListBoxItem id="sold" textValue="Vendida">Vendida</ListBoxItem>
                        </ListBox>
                    </SelectPopover>
                </Select>
                {(search || statusFilter) && (
                    <Button variant="ghost" size="sm" onPress={() => { setSearch(""); setStatusFilter(""); setPage(1); }}>
                        ✕ Limpiar
                    </Button>
                )}
                <span className="text-xs text-default-500 ml-auto">{filtered.length} boletas</span>
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center mb-3">
                        <Ticket className="h-6 w-6 text-default-400" />
                    </div>
                    <p className="text-sm font-medium text-default-600 mb-1">Sin resultados</p>
                    <p className="text-xs text-default-400">No hay boletas que coincidan con los filtros aplicados</p>
                </div>
            ) : (
                <>
          <div className="overflow-x-auto rounded-lg border border-default-200">
              <table className="w-full text-sm">
                  <thead className="bg-default-100">
                      <tr>
                                        <th className="px-4 py-3 text-left font-medium">Números</th>
                          <th className="px-4 py-3 text-left font-medium">Estado</th>
                          <th className="px-4 py-3 text-left font-medium">Cliente</th>
                            <th className="px-4 py-3 text-right font-medium">Abonado</th>
                          <th className="px-4 py-3 text-right font-medium">Saldo</th>
                          <th className="px-4 py-3 text-center font-medium">Acción</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                        {paginatedTickets.map((ticket) => {
                            const amountPaid = ticket.value - ticket.pendingBalance;
                            const canPay = (ticket.status === "assigned" || ticket.status === "sold" || ticket.status === "installment") && ticket.pendingBalance > 0;
                            return (
              <tr key={ticket.number} className="hover:bg-default-50">
                                    <td className="px-4 py-3 font-mono font-bold">{formatTicketNumbers(ticket.numbers, ticket.number)}</td>
                                    <td className="px-4 py-3"><StatusBadge status={deriveTicketStatus(ticket)} /></td>
                    <td className="px-4 py-3">
                        {ticket.customerName ? (
                            <span className={ticket.pendingBalance === 0 ? "text-success font-medium" : ""}>
                                {ticket.customerName}
                                {ticket.pendingBalance === 0 && <span className="ml-1 text-xs">(Pagado ✓)</span>}
                            </span>
                        ) : (
                                          <span className="text-danger italic">Sin cliente</span>
                        )}
                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {amountPaid > 0
                                            ? <span className="text-success font-medium">{formatCurrency(amountPaid)}</span>
                                            : <span className="text-default-400">$0</span>
                                        }
                                    </td>
                    <td className="px-4 py-3 text-right">
                                        {ticket.pendingBalance > 0 && (
                                            <span className="text-red-400 font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                                        )}
                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {/* Se puede desasignar si la boleta no tiene cliente y no tiene ningún
                                                abono (abonado en $0), sin importar el estado. */}
                                            {!ticket.customerName && amountPaid === 0 && (
                                                <Tooltip>
                                                    <Tooltip.Trigger>
                                                        <Button variant="ghost" size="sm" isDisabled={verifyingNum !== null || drawLocked} onPress={() => verifyThenGo(ticket.number, "unassign", () => setConfirmTicket(ticket.number))} aria-label="Desasignar">
                                                            {verifyingNum === ticket.number
                                                                ? <Loader2 className="h-4 w-4 animate-spin text-danger" />
                                                                : <UserMinus className="h-4 w-4 text-danger" />}
                                                        </Button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content>Desasignar boleta</Tooltip.Content>
                                                </Tooltip>
                                            )}
                                            {(ticket.status === "assigned" || ticket.status === "sold" || ticket.status === "installment" || ticket.status === "paid") && (
                                                <Tooltip>
                                                    <Tooltip.Trigger>
                                                        <Button variant="ghost" size="sm" isDisabled={verifyingNum !== null || drawLocked} onPress={() => verifyThenGo(ticket.number, "client", () => onEditTicket(ticket.number, "client"))} aria-label="Agregar cliente">
                                                            {verifyingNum === ticket.number
                                                                ? <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                                                                : <Pencil className="h-4 w-4 text-amber-400" />}
                                                        </Button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content>Agregar cliente</Tooltip.Content>
                                                </Tooltip>
                                            )}
                                            {amountPaid > 0 && userRole === "admin" && (
                                                <Tooltip>
                                                    <Tooltip.Trigger>
                                                        <Button variant="ghost" size="sm" onPress={() => onCorrectPayment(ticket.number)} aria-label="Corregir abono">
                                                            <DollarSign className="h-4 w-4 text-cyan-400" />
                                                        </Button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content>Corregir abono</Tooltip.Content>
                                                </Tooltip>
                                            )}
                                        </div>
                    </td>
              </tr>
                            );
                        })}
                  </tbody>
              </table>
          </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-xs text-default-500">
                                    Mostrando {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" isDisabled={page === 1} onPress={() => setPage(p => p - 1)}>
                            Anterior
                        </Button>
                        <span className="text-xs text-default-500 px-2">{page} / {totalPages}</span>
                        <Button variant="ghost" size="sm" isDisabled={page === totalPages} onPress={() => setPage(p => p + 1)}>
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}
                </>
            )}

          {/* Confirmation dialog */}
          <AlertDialog.Backdrop isOpen={confirmTicket !== null} onOpenChange={(open) => { if (!open) setConfirmTicket(null); }} isDismissable>
              <AlertDialog.Container placement="center" size="sm">
                  <AlertDialog.Dialog>
                      <AlertDialog.CloseTrigger />
                      <AlertDialog.Header>
                          <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>¿Desasignar la boleta {confirmTicket !== null ? formatTicketNumbers(tickets.find(t => t.number === confirmTicket)?.numbers, confirmTicket) : ""}?</AlertDialog.Heading>
                      </AlertDialog.Header>
                      <AlertDialog.Body>
                          <p>La boleta volverá a estar <strong>disponible</strong> y se quitará de este vendedor.</p>
                          <p className="text-sm text-default-500 mt-2">Solo aplica para boletas que aún no han sido vendidas a un cliente.</p>
                      </AlertDialog.Body>
                      <AlertDialog.Footer>
                          <Button slot="close" variant="tertiary">Cancelar</Button>
                          <Button variant="danger" isDisabled={unassigning} onPress={handleUnassign}>
                              {unassigning ? "Desasignando..." : "Sí, desasignar"}
                          </Button>
                      </AlertDialog.Footer>
                  </AlertDialog.Dialog>
              </AlertDialog.Container>
          </AlertDialog.Backdrop>

            {/* Modal de problema detectado al verificar (datos obsoletos). */}
            <AlertDialog.Backdrop isOpen={problem !== null} onOpenChange={(open) => { if (!open) setProblem(null); }} isDismissable>
                <AlertDialog.Container placement="center" size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>La boleta cambió</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>{problem}</p>
                            <p className="text-sm text-default-500 mt-2">Actualiza para ver el estado real de las boletas.</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cerrar</Button>
                            {/* Recargar la página para ver el reflejo puro de la base de datos. */}
                            <Button variant="primary" onPress={() => window.location.reload()}>
                                Actualizar
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
      </>
  );
}
