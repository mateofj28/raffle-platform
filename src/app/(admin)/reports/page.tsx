"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Chip } from "@heroui/react";
import { BarChart3, Download, Printer, Users, DollarSign, ShoppingCart, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment, Vendor, Customer, Ticket } from "@/types/api.types";

type ReportType =
    | null
    | "sales-by-vendor"
    | "unsold-tickets"
    | "revenue-by-method"
    | "pending-balance"
    | "commissions"
    | "morosos"
    | "raffle-status"
    | "vendor-liquidation";

const REPORTS = [
    { id: "sales-by-vendor" as ReportType, label: "Ventas por vendedor", icon: Users, description: "Boletas vendidas por cada vendedor" },
    { id: "unsold-tickets" as ReportType, label: "Boletas sin vender", icon: AlertTriangle, description: "Boletas asignadas pero no vendidas" },
    { id: "revenue-by-method" as ReportType, label: "Recaudo por método", icon: DollarSign, description: "Dinero recaudado por método de pago" },
    { id: "pending-balance" as ReportType, label: "Cartera pendiente", icon: FileText, description: "Clientes con saldo pendiente" },
    { id: "commissions" as ReportType, label: "Comisiones por vendedor", icon: TrendingUp, description: "Comisión acumulada de cada vendedor" },
    { id: "morosos" as ReportType, label: "Clientes morosos", icon: AlertTriangle, description: "Clientes con abonos incompletos" },
    { id: "raffle-status" as ReportType, label: "Estado de la rifa", icon: BarChart3, description: "Resumen de boletas por estado" },
    { id: "vendor-liquidation" as ReportType, label: "Liquidación por vendedor", icon: DollarSign, description: "Cuánto recaudó, comisión y cuánto debe entregar" },
];

export default function ReportsPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { activeRaffle } = useRaffleStore();
    const [selectedReport, setSelectedReport] = useState<ReportType>(null);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<unknown>(null);

    // Data stores
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [vendors, setVendors] = useState<Map<string, Vendor>>(new Map());
    const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());

    // Load all data when a report is selected
    useEffect(() => {
        if (!selectedReport || !tenantId || !activeRaffle) return;
        setLoading(true);

        const loadAll = async () => {
            try {
                // Load tickets
                const ticketsSnap = await getDocs(tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`));
                const ticketsData = ticketsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as unknown as Ticket[];
                setTickets(ticketsData);

                // Load payments
                const paymentsSnap = await getDocs(query(tenantCollection(tenantId, "payments"), where("raffleId", "==", activeRaffle.id)));
                setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);

                // Load vendors
                const vendorsSnap = await getDocs(tenantCollection(tenantId, "vendors"));
                const vMap = new Map<string, Vendor>();
                vendorsSnap.docs.forEach(d => vMap.set(d.id, { id: d.id, ...d.data() } as Vendor));
                setVendors(vMap);

                // Load customers
                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                const cMap = new Map<string, Customer>();
                customersSnap.docs.forEach(d => cMap.set(d.id, { id: d.id, ...d.data() } as Customer));
                setCustomers(cMap);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        loadAll();
    }, [selectedReport, tenantId, activeRaffle]);

    const handlePrint = () => window.print();

    if (!activeRaffle) return (
        <div>
            <PageHeader title="Reportes" description="Selecciona una rifa activa primero" />
        </div>
    );

    return (
        <div>
            <PageHeader title="Reportes" description={`Rifa: ${activeRaffle.name}`} />

            {!selectedReport ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {REPORTS.map(r => (
                        <button key={r.id} onClick={() => setSelectedReport(r.id)} className="text-left p-5 rounded-xl border border-default-200 hover:border-primary hover:bg-primary/5 transition-all">
                            <r.icon className="h-6 w-6 text-primary mb-3" />
                            <p className="font-semibold text-sm">{r.label}</p>
                            <p className="text-xs text-default-500 mt-1">{r.description}</p>
                        </button>
                    ))}
                </div>
            ) : (
                <div>
                    <div className="flex items-center justify-between mb-4 print:hidden">
                        <Button variant="ghost" size="sm" onPress={() => setSelectedReport(null)}>← Volver a reportes</Button>
                        <Button variant="outline" size="sm" onPress={handlePrint}><Printer className="h-4 w-4" /> Imprimir</Button>
                    </div>

                    {loading ? <LoadingSkeleton rows={8} /> : (
                        <ReportContent
                            type={selectedReport}
                            tickets={tickets}
                            payments={payments}
                            vendors={vendors}
                            customers={customers}
                            ticketPrice={activeRaffle.ticketPrice}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// --- Report Content ---

function ReportContent({ type, tickets, payments, vendors, customers, ticketPrice }: {
    type: ReportType;
    tickets: Ticket[];
    payments: Payment[];
    vendors: Map<string, Vendor>;
    customers: Map<string, Customer>;
    ticketPrice: number;
}) {
    switch (type) {
        case "sales-by-vendor": return <SalesByVendor tickets={tickets} vendors={vendors} customers={customers} />;
        case "unsold-tickets": return <UnsoldTickets tickets={tickets} vendors={vendors} />;
        case "revenue-by-method": return <RevenueByMethod payments={payments} />;
        case "pending-balance": return <PendingBalance tickets={tickets} customers={customers} vendors={vendors} ticketPrice={ticketPrice} />;
        case "commissions": return <Commissions tickets={tickets} vendors={vendors} ticketPrice={ticketPrice} />;
        case "morosos": return <Morosos tickets={tickets} customers={customers} ticketPrice={ticketPrice} />;
        case "raffle-status": return <RaffleStatus tickets={tickets} ticketPrice={ticketPrice} />;
        case "vendor-liquidation": return <VendorLiquidation tickets={tickets} vendors={vendors} ticketPrice={ticketPrice} />;
        default: return null;
    }
}

// --- Individual Reports ---

function SalesByVendor({ tickets, vendors, customers }: { tickets: Ticket[]; vendors: Map<string, Vendor>; customers: Map<string, Customer> }) {
    const soldTickets = tickets.filter(t => ["sold", "paid", "installment"].includes(t.status));
    const byVendor = new Map<string, Ticket[]>();
    soldTickets.forEach(t => {
        if (!t.vendorId) return;
        const arr = byVendor.get(t.vendorId) || [];
        arr.push(t);
        byVendor.set(t.vendorId, arr);
    });

    return (
        <div>
            <h2 className="text-lg font-bold mb-4">Ventas por vendedor</h2>
            {Array.from(byVendor.entries()).map(([vendorId, vTickets]) => (
                <div key={vendorId} className="mb-6">
                    <h3 className="font-semibold mb-2">{vendors.get(vendorId)?.name || vendorId} — {vTickets.length} boletas vendidas</h3>
                    <Table headers={["#", "Cliente", "Estado", "Abonado", "Saldo"]}>
                        {vTickets.map(t => (
                            <tr key={t.number}>
                                <td className="px-3 py-2 font-mono">{t.number}</td>
                                <td className="px-3 py-2">{t.customerId ? customers.get(t.customerId)?.name || "—" : "—"}</td>
                                <td className="px-3 py-2">{t.status}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(t.value - t.pendingBalance)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(t.pendingBalance)}</td>
                            </tr>
                        ))}
                    </Table>
                </div>
            ))}
            {byVendor.size === 0 && <p className="text-default-500">No hay ventas registradas</p>}
        </div>
    );
}

function UnsoldTickets({ tickets, vendors }: { tickets: Ticket[]; vendors: Map<string, Vendor> }) {
    const unsold = tickets.filter(t => t.status === "assigned");
    return (
        <div>
            <h2 className="text-lg font-bold mb-2">Boletas sin vender</h2>
            <Chip size="sm" variant="soft" color="warning" className="px-3 py-1 mb-4">{unsold.length} boletas asignadas sin vender</Chip>
            <Table headers={["#", "Vendedor"]}>
                {unsold.map(t => (
                    <tr key={t.number}>
                        <td className="px-3 py-2 font-mono">{t.number}</td>
                        <td className="px-3 py-2">{t.vendorId ? vendors.get(t.vendorId)?.name || "—" : "Sin asignar"}</td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

function RevenueByMethod({ payments }: { payments: Payment[] }) {
    const byMethod = new Map<string, number>();
    payments.forEach(p => {
        byMethod.set(p.method, (byMethod.get(p.method) || 0) + p.amount);
    });
    const total = payments.reduce((s, p) => s + p.amount, 0);

    return (
        <div>
            <h2 className="text-lg font-bold mb-2">Recaudo por método de pago</h2>
            <Chip size="sm" variant="soft" color="success" className="px-3 py-1 mb-4">Total recaudado: {formatCurrency(total)}</Chip>
            <Table headers={["Método", "Cantidad pagos", "Monto total", "% del total"]}>
                {Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                    <tr key={method}>
                        <td className="px-3 py-2"><PaymentMethodBadge method={method} /></td>
                        <td className="px-3 py-2 text-center">{payments.filter(p => p.method === method).length}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(amount)}</td>
                        <td className="px-3 py-2 text-right">{total > 0 ? Math.round((amount / total) * 100) : 0}%</td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

function PendingBalance({ tickets, customers, vendors, ticketPrice }: { tickets: Ticket[]; customers: Map<string, Customer>; vendors: Map<string, Vendor>; ticketPrice: number }) {
    const pending = tickets.filter(t => t.pendingBalance > 0 && ["sold", "installment"].includes(t.status));
    const totalPending = pending.reduce((s, t) => s + t.pendingBalance, 0);

    return (
        <div>
            <h2 className="text-lg font-bold mb-2">Cartera pendiente</h2>
            <Chip size="sm" variant="soft" color="danger" className="px-3 py-1 mb-4">Total pendiente: {formatCurrency(totalPending)} — {pending.length} boletas</Chip>
            <Table headers={["#", "Cliente", "Vendedor", "Abonado", "Pendiente"]}>
                {pending.sort((a, b) => b.pendingBalance - a.pendingBalance).map(t => (
                    <tr key={t.number}>
                        <td className="px-3 py-2 font-mono">{t.number}</td>
                        <td className="px-3 py-2">{t.customerId ? customers.get(t.customerId)?.name || "—" : "—"}</td>
                        <td className="px-3 py-2">{t.vendorId ? vendors.get(t.vendorId)?.name || "—" : "—"}</td>
                        <td className="px-3 py-2 text-right text-success">{formatCurrency(t.value - t.pendingBalance)}</td>
                        <td className="px-3 py-2 text-right text-danger font-semibold">{formatCurrency(t.pendingBalance)}</td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

function Commissions({ tickets, vendors, ticketPrice }: { tickets: Ticket[]; vendors: Map<string, Vendor>; ticketPrice: number }) {
    const byVendor = new Map<string, { collected: number; commission: number }>();
    tickets.forEach(t => {
        if (!t.vendorId) return;
        const collected = t.value - t.pendingBalance;
        if (collected <= 0) return;
        const current = byVendor.get(t.vendorId) || { collected: 0, commission: 0 };
        current.collected += collected;
        current.commission += Math.floor(collected * 0.30);
        byVendor.set(t.vendorId, current);
    });

    return (
        <div>
            <h2 className="text-lg font-bold mb-4">Comisiones por vendedor</h2>
            <Table headers={["Vendedor", "Recaudado", "Comisión (10%)", "Entrega a empresa"]}>
                {Array.from(byVendor.entries()).sort((a, b) => b[1].commission - a[1].commission).map(([vendorId, data]) => (
                    <tr key={vendorId}>
                        <td className="px-3 py-2 font-medium">{vendors.get(vendorId)?.name || vendorId}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(data.collected)}</td>
                        <td className="px-3 py-2 text-right text-amber-500 font-semibold">{formatCurrency(data.commission)}</td>
                        <td className="px-3 py-2 text-right text-success font-semibold">{formatCurrency(data.collected - data.commission)}</td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

function Morosos({ tickets, customers, ticketPrice }: { tickets: Ticket[]; customers: Map<string, Customer>; ticketPrice: number }) {
    // Tickets with partial payment (installment) that still owe
    const morosos = tickets.filter(t => t.status === "installment" && t.pendingBalance > 0 && t.customerId);
    const byCustomer = new Map<string, { name: string; tickets: Ticket[] }>();
    morosos.forEach(t => {
        const customer = customers.get(t.customerId!);
        const name = customer?.name || "Desconocido";
        const current = byCustomer.get(t.customerId!) || { name, tickets: [] };
        current.tickets.push(t);
        byCustomer.set(t.customerId!, current);
    });

    return (
        <div>
            <h2 className="text-lg font-bold mb-2">Clientes con abonos pendientes</h2>
            <Chip size="sm" variant="soft" color="danger" className="px-3 py-1 mb-4">{byCustomer.size} clientes con saldo pendiente</Chip>
            <Table headers={["Cliente", "Teléfono", "Boletas", "Total pendiente"]}>
                {Array.from(byCustomer.entries()).map(([customerId, data]) => {
                    const customer = customers.get(customerId);
                    const totalPending = data.tickets.reduce((s, t) => s + t.pendingBalance, 0);
                    return (
                        <tr key={customerId}>
                            <td className="px-3 py-2 font-medium">{data.name}</td>
                            <td className="px-3 py-2">{customer?.phone || "—"}</td>
                            <td className="px-3 py-2 text-center">{data.tickets.map(t => `#${t.number}`).join(", ")}</td>
                            <td className="px-3 py-2 text-right text-danger font-semibold">{formatCurrency(totalPending)}</td>
                        </tr>
                    );
                })}
            </Table>
            {byCustomer.size === 0 && <p className="text-default-500 mt-4">No hay clientes con saldo pendiente</p>}
        </div>
    );
}

function RaffleStatus({ tickets, ticketPrice }: { tickets: Ticket[]; ticketPrice: number }) {
    const statuses = {
        available: tickets.filter(t => t.status === "available").length,
        assigned: tickets.filter(t => t.status === "assigned").length,
        sold: tickets.filter(t => t.status === "sold").length,
        installment: tickets.filter(t => t.status === "installment").length,
        paid: tickets.filter(t => t.status === "paid").length,
    };
    const totalCollected = tickets.reduce((s, t) => s + (t.value - t.pendingBalance), 0);
    const totalPotential = tickets.length * ticketPrice;

    return (
        <div>
            <h2 className="text-lg font-bold mb-4">Estado general de la rifa</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <StatBox label="Disponibles" value={statuses.available} color="text-default-600" />
                <StatBox label="Asignadas" value={statuses.assigned} color="text-amber-500" />
                <StatBox label="Vendidas" value={statuses.sold} color="text-blue-500" />
                <StatBox label="En abonos" value={statuses.installment} color="text-purple-500" />
                <StatBox label="Pagadas" value={statuses.paid} color="text-success" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg border border-default-200">
                    <p className="text-xs text-default-500">Total boletas</p>
                    <p className="text-xl font-bold">{tickets.length}</p>
                </div>
                <div className="p-4 rounded-lg border border-success/20 bg-success/5">
                    <p className="text-xs text-default-500">Total recaudado</p>
                    <p className="text-xl font-bold text-success">{formatCurrency(totalCollected)}</p>
                </div>
                <div className="p-4 rounded-lg border border-default-200">
                    <p className="text-xs text-default-500">Potencial total</p>
                    <p className="text-xl font-bold">{formatCurrency(totalPotential)}</p>
                </div>
            </div>
        </div>
    );
}

function VendorLiquidation({ tickets, vendors, ticketPrice }: { tickets: Ticket[]; vendors: Map<string, Vendor>; ticketPrice: number }) {
    const byVendor = new Map<string, { assigned: number; sold: number; paid: number; installment: number; collected: number; commission: number }>();

    tickets.forEach(t => {
        if (!t.vendorId) return;
        const current = byVendor.get(t.vendorId) || { assigned: 0, sold: 0, paid: 0, installment: 0, collected: 0, commission: 0 };
        if (t.status === "assigned") current.assigned++;
        if (t.status === "sold") current.sold++;
        if (t.status === "paid") current.paid++;
        if (t.status === "installment") current.installment++;
        const collected = t.value - t.pendingBalance;
        current.collected += collected;
        current.commission += Math.floor(collected * 0.30);
        byVendor.set(t.vendorId, current);
    });

    return (
        <div>
            <h2 className="text-lg font-bold mb-4">Liquidación por vendedor</h2>
            <Table headers={["Vendedor", "Asignadas", "Vendidas", "Pagadas", "Abonadas", "Recaudado", "Comisión", "Entrega"]}>
                {Array.from(byVendor.entries()).map(([vendorId, data]) => (
                    <tr key={vendorId}>
                        <td className="px-3 py-2 font-medium">{vendors.get(vendorId)?.name || vendorId}</td>
                        <td className="px-3 py-2 text-center">{data.assigned}</td>
                        <td className="px-3 py-2 text-center">{data.sold}</td>
                        <td className="px-3 py-2 text-center">{data.paid}</td>
                        <td className="px-3 py-2 text-center">{data.installment}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(data.collected)}</td>
                        <td className="px-3 py-2 text-right text-amber-500">{formatCurrency(data.commission)}</td>
                        <td className="px-3 py-2 text-right text-success font-semibold">{formatCurrency(data.collected - data.commission)}</td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

// --- Shared Components ---

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-default-200">
            <table className="w-full text-sm">
                <thead className="bg-default-100">
                    <tr>
                        {headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-xs">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-default-100">
                    {children}
                </tbody>
            </table>
        </div>
    );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="p-3 rounded-lg border border-default-200 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-default-500">{label}</p>
        </div>
    );
}
