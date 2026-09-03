"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip, AlertDialog, Tooltip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem, toast } from "@heroui/react";
import { ArrowLeft, User, Phone, Hash, Ticket, UserMinus, ShoppingCart, DollarSign, Pencil, ChevronDown, X, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
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

    const assigned = tickets.filter(t => t.status === "assigned").length;
    const sold = tickets.filter(t => t.status === "sold").length;
    const paid = tickets.filter(t => t.status === "paid").length;
    const installment = tickets.filter(t => t.status === "installment").length;

    // Financial metrics
    const paidTickets = tickets.filter(t => t.status === "paid");
    const installmentTickets = tickets.filter(t => t.status === "installment");

    const totalAbonado = tickets.reduce((sum, t) => sum + (t.value - t.pendingBalance), 0);
    const recaudadoPagadas = paidTickets.reduce((sum, t) => sum + t.value, 0);
    const recaudadoAbonadas = installmentTickets.reduce((sum, t) => sum + (t.value - t.pendingBalance), 0);
    const commission = Math.floor(totalAbonado * 0.30);

    // Payment panel handlers
    const handleAddPayment = () => {
        const num = parseInt(payTicketInput);
        const amount = parseInt(payAmountInput.replace(/\D/g, "") || "0");
        if (!num) { setPayError("Ingresa un número de boleta"); return; }
        if (amount < 5000) { setPayError("El monto mínimo es $5.000"); return; }

        const ticket = tickets.find(t => t.number === num);
        if (!ticket) { setPayError(`Boleta #${num} no pertenece a este vendedor`); return; }
        if (ticket.pendingBalance <= 0) { setPayError(`Boleta #${num} ya está completamente pagada`); return; }
        if (amount > ticket.pendingBalance) { setPayError(`Máximo para boleta #${num}: ${formatCurrency(ticket.pendingBalance)}`); return; }

        setPaymentList(prev => [...prev, { ticketNumber: num, amount, method: payMethodInput }]);
        setPayTicketInput("");
        setPayAmountInput("");
        setPayError(null);
        // Devolver el foco al campo de boleta para seguir ingresando sin usar el mouse
        payTicketInputRef.current?.focus();
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
                    setPayError(`Error en boleta #${p.ticketNumber}: ${msg}`);
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

    return (
      <div>
          <PageHeader
              title={vendor.name}
              description={`Boletas en "${activeRaffle.name}"`}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="primary" size="sm" onPress={() => setShowPaymentPanel(true)}>
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
                                <label className="text-xs font-medium mb-1 block">Boleta</label>
                                <Input ref={payTicketInputRef} placeholder="Ej: 55" value={payTicketInput} onChange={(e) => setPayTicketInput(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" className="w-24" maxLength={5} />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1 block">Monto</label>
                                <Input placeholder="Ej: 30.000" value={payAmountInput ? parseInt(payAmountInput).toLocaleString("es-CO") : ""} onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); const num = parseInt(raw || "0"); if (num <= (activeRaffle?.ticketPrice || 999999)) setPayAmountInput(raw); }} inputMode="numeric" className="w-32" />
                            </div>
                            <div>
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
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30">
                                            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{p.ticketNumber}</span>
                                        </div>
                                        <div className="flex-1">
                                            {editingPayIndex === i ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editingPayValue ? parseInt(editingPayValue).toLocaleString("es-CO") : ""}
                                                        onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); if (parseInt(raw || "0") <= (activeRaffle?.ticketPrice || 999999)) setEditingPayValue(raw); }}
                                                        inputMode="numeric"
                                                        className="w-28"
                                                    />
                                                    <button onClick={() => { if (editingPayValue && parseInt(editingPayValue) >= 5000) { setPaymentList(prev => prev.map((item, idx) => idx === i ? { ...item, amount: parseInt(editingPayValue) } : item)); setEditingPayIndex(null); } }} className="text-xs text-emerald-600 font-medium hover:underline">Guardar</button>
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
                                                <button onClick={() => { setEditingPayIndex(i); setEditingPayValue(String(p.amount)); }} className="p-1.5 rounded-md hover:bg-default-100 text-default-400 hover:text-amber-500 transition-colors">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => handleRemovePayment(i)} className="p-1.5 rounded-md hover:bg-default-100 text-default-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-default-200">
                                    <div className="flex items-center gap-6">
                                        <p className="text-sm font-semibold">Total: <span className="text-emerald-500">{formatCurrency(paymentList.reduce((s, p) => s + p.amount, 0))}</span></p>
                                        <p className="text-xs text-default-500">Recibe cajero (70%): <span className="font-medium">{formatCurrency(Math.floor(paymentList.reduce((s, p) => s + p.amount, 0) * 0.70))}</span></p>
                                        <p className="text-xs text-default-500">Comisión vendedor (30%): <span className="font-medium text-amber-500">{formatCurrency(Math.floor(paymentList.reduce((s, p) => s + p.amount, 0) * 0.30))}</span></p>
                                    </div>
                                    <Button variant="primary" isDisabled={processing} onPress={handleConfirmPayments}>
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
                        <Chip size="sm" variant="soft" color="accent" className="px-3 py-1">Vendidas: {sold}</Chip>
                        <Chip size="sm" variant="soft" color="success" className="px-3 py-1">Pagadas: {paid}</Chip>
                        <Chip size="sm" variant="soft" color="danger" className="px-3 py-1">Abonadas: {installment}</Chip>
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
                            <TicketsTableWithUnassign tickets={tickets} raffleId={activeRaffle.id} onReload={() => setReloadKey(k => k + 1)} onSell={(num) => router.push(`/sell/${num}`)} onPay={(num) => router.push(`/pay/${num}`)} onEditTicket={(num, action) => router.push(`/edit-ticket/${num}?action=${action}`)} onCorrectPayment={(num) => router.push(`/correct-payment/${num}`)} userRole={userRole} />
                  )}
              </>
          )}

      </div>
  );
}

// --- Table with unassign (SRP) ---

function TicketsTableWithUnassign({ tickets, raffleId, onReload, onSell, onPay, onEditTicket, onCorrectPayment, userRole }: { tickets: TicketWithCustomer[]; raffleId: string; onReload: () => void; onSell: (ticketNum: number) => void; onPay: (ticketNum: number) => void; onEditTicket: (ticketNum: number, action: string) => void; onCorrectPayment: (ticketNum: number) => void; userRole?: string }) {
    const [confirmTicket, setConfirmTicket] = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const PAGE_SIZE = 20;

    // Filter tickets
    const filtered = tickets.filter(t => {
        if (statusFilter && t.status !== statusFilter) return false;
        if (search) {
            const term = search.toLowerCase();
            const matchesNumber = String(t.number).includes(term);
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
            await ticketService.unassign(raffleId, [confirmTicket]);
            setConfirmTicket(null);
            onReload();
        } catch (e) { console.error(e); }
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
                            <ListBoxItem id="sold" textValue="Vendida">Vendida</ListBoxItem>
                            <ListBoxItem id="paid" textValue="Pagada">Pagada</ListBoxItem>
                            <ListBoxItem id="installment" textValue="Abonada">Abonada</ListBoxItem>
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
                          <th className="px-4 py-3 text-left font-medium">#</th>
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
                    <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
                    <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
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
                                            {ticket.status === "assigned" && (
                                                <Tooltip>
                                                    <Tooltip.Trigger>
                                                        <Button variant="ghost" size="sm" onPress={() => setConfirmTicket(ticket.number)} aria-label="Desasignar">
                                                            <UserMinus className="h-4 w-4 text-danger" />
                                                        </Button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content>Desasignar boleta</Tooltip.Content>
                                                </Tooltip>
                                            )}
                                            {(ticket.status === "assigned" || ticket.status === "sold" || ticket.status === "installment" || ticket.status === "paid") && (
                                                <Tooltip>
                                                    <Tooltip.Trigger>
                                                        <Button variant="ghost" size="sm" onPress={() => onEditTicket(ticket.number, "client")} aria-label="Agregar cliente">
                                                            <Pencil className="h-4 w-4 text-amber-400" />
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
                          <AlertDialog.Heading>¿Desasignar boleta #{confirmTicket}?</AlertDialog.Heading>
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
      </>
  );
}
