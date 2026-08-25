"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, Separator, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem, AlertDialog, toast } from "@heroui/react";
import { Ticket, Calendar, Trophy, Hash, DollarSign, ArrowLeft, UserPlus, UserMinus, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import { callFunction } from "@/services/firebase-callable";
import type { Raffle, Ticket as TicketType, Vendor } from "@/types/api.types";

export default function RaffleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const raffleId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { setActiveRaffle } = useRaffleStore();

    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [tickets, setTickets] = useState<TicketType[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);

    // Assignment mode
    const [assignMode, setAssignMode] = useState<"assign" | "unassign" | null>(null);
    const [selectedVendor, setSelectedVendor] = useState("");
    const [ticketInput, setTicketInput] = useState("");
    const [assignList, setAssignList] = useState<number[]>([]);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [showNoVendorsModal, setShowNoVendorsModal] = useState(false);

    // Load raffle
    useEffect(() => {
        if (!tenantId || !raffleId) return;
        const load = async () => {
            try {
                const raffleDoc = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", raffleId));
                if (raffleDoc.exists()) {
                    const data = raffleDoc.data();
                    setRaffle({ id: raffleDoc.id, ...data } as Raffle);
                    setActiveRaffle({ id: raffleDoc.id, name: data.name, status: data.status, ticketPrice: data.ticketPrice, totalTickets: data.totalTickets });
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, raffleId, setActiveRaffle]);

    // Load tickets
    useEffect(() => {
        if (!tenantId || !raffleId) return;
        const load = async () => {
            setTicketsLoading(true);
            try {
                const col = tenantCollection(tenantId, `raffles/${raffleId}/tickets`);
                const q = query(col, orderBy("number", "asc"));
                const snap = await getDocs(q);
                setTickets(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as unknown as TicketType[]);
            } catch (e) { console.error(e); }
            finally { setTicketsLoading(false); }
        };
        load();
    }, [tenantId, raffleId]);

    // Load vendors
    useEffect(() => {
        if (!tenantId) return;
        const load = async () => {
            const col = tenantCollection(tenantId, "vendors");
            const q = query(col, orderBy("name", "asc"));
            const snap = await getDocs(q);
            setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vendor[]);
        };
        load();
    }, [tenantId]);

    // Add ticket to list
    const handleAddTicket = () => {
        const num = parseInt(ticketInput);
        if (!num || num < 1) { setAssignError("Ingresa un número válido"); return; }
        if (assignList.includes(num)) { setAssignError(`Boleta #${num} ya está en la lista`); return; }

        const ticket = tickets.find(t => t.number === num);
        if (!ticket) { setAssignError(`Boleta #${num} no existe`); return; }

        if (assignMode === "assign") {
            if (ticket.status !== "available") {
                const vendorName = ticket.vendorId ? vendors.find(v => v.id === ticket.vendorId)?.name || "otro vendedor" : "";
                setAssignError(`Boleta #${num} no está disponible${vendorName ? ` — asignada a ${vendorName}` : ""}`);
                return;
            }
        } else {
            if (ticket.status !== "assigned") {
                setAssignError(`Boleta #${num} no está asignada (estado: ${ticket.status})`);
                return;
            }
        }

        setAssignList(prev => [...prev, num]);
        setTicketInput("");
        setAssignError(null);
    };

    const handleRemoveFromList = (num: number) => setAssignList(prev => prev.filter(n => n !== num));

    // Confirm
    const handleConfirmAssign = async () => {
        if (assignList.length === 0) return;
        setAssigning(true);
        setAssignError(null);
        try {
            if (assignMode === "assign") {
                const result = await callFunction<{ assigned: number; skipped: number }>("assignTickets", { raffleId, vendorId: selectedVendor, ticketNumbers: assignList });
                toast.success(`${result.assigned} boletas asignadas`);
                setTickets(prev => prev.map(t => assignList.includes(t.number) && t.status === "available" ? { ...t, status: "assigned" as const, vendorId: selectedVendor } : t));
            } else {
                await callFunction("unassignTickets", { raffleId, ticketNumbers: assignList });
                toast.success(`${assignList.length} boleta(s) liberada(s)`);
                setTickets(prev => prev.map(t => assignList.includes(t.number) && t.status === "assigned" ? { ...t, status: "available" as const, vendorId: null } : t));
            }
            setAssignList([]);
            setAssignMode(null);
            setSelectedVendor("");
        } catch (err) {
            setAssignError(err instanceof Error ? err.message : "Error al procesar");
        } finally { setAssigning(false); }
    };

    const cancelMode = () => { setAssignMode(null); setAssignList([]); setSelectedVendor(""); setTicketInput(""); setAssignError(null); };

    if (loading) return <div><PageHeader title="Detalle de Rifa" /><LoadingSkeleton rows={6} /></div>;
    if (!raffle) return <div><PageHeader title="Rifa no encontrada" /><p className="text-default-500">No se encontró la rifa.</p></div>;

    const statusCounts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <div>
            <PageHeader
                title={raffle.name}
                description={raffle.description}
                actions={
                    <div className="flex gap-2">
                        <Link href="/raffles"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button></Link>
                        {!assignMode && (
                            <Button variant="primary" size="sm" onPress={() => { if (vendors.length === 0) { setShowNoVendorsModal(true); return; } setAssignMode("assign"); }}>
                                <UserPlus className="h-4 w-4" /> Asignar
                            </Button>
                        )}
                        {!assignMode && (
                            <Button variant="outline" size="sm" onPress={() => setAssignMode("unassign")}>
                                <UserMinus className="h-4 w-4" /> Desasignar
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Raffle Info */}
            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30"><Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div>
                            <div><p className="text-xs text-default-500">Premio</p><p className="font-semibold text-sm">{raffle.prize}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30"><DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                            <div><p className="text-xs text-default-500">Precio boleta</p><p className="font-semibold text-sm">{formatCurrency(raffle.ticketPrice)}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30"><Hash className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                            <div><p className="text-xs text-default-500">Total boletas</p><p className="font-semibold text-sm">{raffle.totalTickets.toLocaleString()}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30"><Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                            <div><p className="text-xs text-default-500">Sorteo</p><p className="font-semibold text-sm">{formatDate(raffle.drawDate)}</p></div>
                        </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2"><span className="text-sm text-default-500">Estado:</span><StatusBadge status={raffle.status} /></div>
                        <div className="flex items-center gap-2"><span className="text-sm text-default-500">Lotería:</span><span className="text-sm font-medium">{raffle.lottery}</span></div>
                    </div>
                </CardContent>
            </Card>

            {/* Status summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <div className="p-3 rounded-lg border border-default-200 text-center">
                    <p className="text-xl font-bold text-zinc-500">{statusCounts["available"] || 0}</p>
                    <p className="text-xs text-default-500">Disponible</p>
                </div>
                <div className="p-3 rounded-lg border border-default-200 text-center">
                    <p className="text-xl font-bold text-amber-500">{statusCounts["assigned"] || 0}</p>
                    <p className="text-xs text-default-500">Asignada</p>
                </div>
                <div className="p-3 rounded-lg border border-default-200 text-center">
                    <p className="text-xl font-bold text-blue-500">{statusCounts["sold"] || 0}</p>
                    <p className="text-xs text-default-500">Vendida</p>
                </div>
                <div className="p-3 rounded-lg border border-default-200 text-center">
                    <p className="text-xl font-bold text-emerald-500">{statusCounts["paid"] || 0}</p>
                    <p className="text-xs text-default-500">Pagada</p>
                </div>
                <div className="p-3 rounded-lg border border-default-200 text-center">
                    <p className="text-xl font-bold text-purple-500">{statusCounts["installment"] || 0}</p>
                    <p className="text-xs text-default-500">Abonada</p>
                </div>
            </div>

            {/* Assignment Panel */}
            {assignMode && (
                <Card className={`mb-6 border-2 ${assignMode === "assign" ? "border-teal-500/50" : "border-red-500/50"}`}>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold">{assignMode === "assign" ? "Asignar boletas" : "Desasignar boletas"}</h3>
                            <Button variant="ghost" size="sm" onPress={cancelMode}><X className="h-4 w-4" /> Cancelar</Button>
                        </div>

                        {assignMode === "assign" && (
                            <div className="mb-4">
                                <label className="text-sm font-medium mb-1.5 block">Vendedor</label>
                                <Select aria-label="Vendedor" selectedKey={selectedVendor || null} onSelectionChange={(key) => setSelectedVendor(String(key ?? ""))} placeholder="Seleccionar vendedor" className="w-full sm:w-64">
                                    <SelectTrigger className="w-full"><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                    <SelectPopover><ListBox>{vendors.map((v) => (<ListBoxItem key={v.id} id={v.id} textValue={v.name}>{v.name}</ListBoxItem>))}</ListBox></SelectPopover>
                                </Select>
                            </div>
                        )}

                        <div className="flex items-end gap-2 mb-3">
                            <div className="flex-1 max-w-xs">
                                <label className="text-sm font-medium mb-1.5 block">Número de boleta</label>
                                <Input placeholder="Ej: 1234" value={ticketInput} onChange={(e) => setTicketInput(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTicket(); } }} inputMode="numeric" className="w-full" />
                            </div>
                            <Button variant="outline" size="sm" onPress={handleAddTicket} isDisabled={!ticketInput || (assignMode === "assign" && !selectedVendor)}>Agregar</Button>
                        </div>

                        <FormErrorBanner message={assignError} />

                        {assignList.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs text-default-500 mb-3">{assignList.length} boleta(s) seleccionadas</p>
                                <div className="flex flex-wrap gap-2">
                                    {assignList.sort((a, b) => a - b).map(num => (
                                        <div key={num} className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-default-200 bg-white dark:bg-[#1A2F50] hover:border-red-300 transition-colors">
                                            <Ticket className="h-3.5 w-3.5 text-teal-500" />
                                            <span className="text-sm font-semibold">{num}</span>
                                            <button onClick={() => handleRemoveFromList(num)} className="text-default-300 group-hover:text-red-500 transition-colors">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {assignList.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-default-200">
                                <Button variant="primary" isDisabled={assigning || (assignMode === "assign" && !selectedVendor)} onPress={handleConfirmAssign}>
                                    {assigning ? "Procesando..." : assignMode === "assign" ? `Confirmar asignación (${assignList.length})` : `Confirmar desasignación (${assignList.length})`}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* No vendors modal */}
            <AlertDialog.Backdrop isOpen={showNoVendorsModal} onOpenChange={setShowNoVendorsModal} isDismissable>
                <AlertDialog.Container placement="center" size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>No hay vendedores</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>Para asignar boletas necesitas al menos un vendedor.</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cancelar</Button>
                            <Button variant="primary" onPress={() => { setShowNoVendorsModal(false); router.push("/vendors/new"); }}>Crear Vendedor</Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </div>
    );
}
