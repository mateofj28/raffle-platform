"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator } from "@heroui/react";
import { DollarSign, Users, CreditCard, ArrowLeft, TrendingUp, Percent, Calendar, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useRaffleStore } from "@/store/raffle.store";
import { useAuthStore } from "@/store/auth.store";
import { useSettingsStore } from "@/store/settings.store";
import { getDocs, query, orderBy, where } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

interface RaffleMetrics {
    totalTickets: number;
    available: number;
    assigned: number;
    sold: number;
    paid: number;
    installment: number;
    totalCollected: number;
    totalPending: number;
    totalPotential: number;
    vendorsCount: number;
    customersCount: number;
    commissionGenerated: number;
    companyProfit: number;
}

interface TodayMetrics {
    ticketsSold: number;
    moneyCollected: number;
    paymentsCount: number;
    topMethod: string;
    topVendor: string;
    recentPayments: Payment[];
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const { activeRaffle } = useRaffleStore();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const commissionRate = useSettingsStore((s) => s.settings.commissionRate);
    const [metrics, setMetrics] = useState<RaffleMetrics | null>(null);
    const [todayMetrics, setTodayMetrics] = useState<TodayMetrics | null>(null);
    const [methodTotals, setMethodTotals] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [vendorsMap, setVendorsMap] = useState<Map<string, string>>(new Map());
    const [customersMap, setCustomersMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        if (!activeRaffle) { router.push("/raffles"); }
    }, [activeRaffle, router]);

    useEffect(() => {
        if (!tenantId || !activeRaffle) return;
        const load = async () => {
            setLoading(true);
            try {
                // Load vendors and customers for name resolution
                const vendorsSnap = await getDocs(tenantCollection(tenantId, "vendors"));
                const vMap = new Map<string, string>();
                vendorsSnap.docs.forEach(d => vMap.set(d.id, d.data().name));
                setVendorsMap(vMap);

                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                const cMap = new Map<string, string>();
                customersSnap.docs.forEach(d => cMap.set(d.id, d.data().name));
                setCustomersMap(cMap);

                // Load all tickets for this raffle
                const ticketsCol = tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`);
                const ticketsSnap = await getDocs(query(ticketsCol, orderBy("number", "asc")));

                let available = 0, assigned = 0, sold = 0, paid = 0, installment = 0;
                let totalCollected = 0, totalPending = 0;
                const vendorIds = new Set<string>();
                const customerIds = new Set<string>();

                ticketsSnap.docs.forEach(d => {
                    const t = d.data();
                    switch (t.status) {
                        case "available": available++; break;
                        case "assigned": assigned++; break;
                        case "sold": sold++; break;
                        case "paid": paid++; break;
                        case "installment": installment++; break;
                    }
                    if (t.vendorId) vendorIds.add(t.vendorId);
                    if (t.customerId) customerIds.add(t.customerId);
                    totalCollected += (t.value - t.pendingBalance);
                    totalPending += t.pendingBalance;
                });

                const totalPotential = activeRaffle.totalTickets * activeRaffle.ticketPrice;
                const commissionGenerated = Math.floor(totalCollected * commissionRate);
                const companyProfit = totalCollected - commissionGenerated;

                setMetrics({
                    totalTickets: ticketsSnap.size,
                    available, assigned, sold, paid, installment,
                    totalCollected, totalPending, totalPotential,
                    vendorsCount: vendorIds.size,
                    customersCount: customerIds.size,
                    commissionGenerated, companyProfit,
                });

                // Load today's payments
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const paymentsCol = tenantCollection(tenantId, "payments");
                const paymentsSnap = await getDocs(query(paymentsCol, where("raffleId", "==", activeRaffle.id), orderBy("createdAt", "desc")));
                const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[];

                // Calculate totals by payment method
                const byMethod: Record<string, number> = {};
                allPayments.forEach(p => {
                    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
                });
                setMethodTotals(byMethod);

                // Filter today's payments
                const todayPayments = allPayments.filter(p => {
                    if (!p.createdAt) return false;
                    const pDate = typeof p.createdAt === "string" ? new Date(p.createdAt) : (p.createdAt as any).toDate?.() || new Date((p.createdAt as any).seconds * 1000);
                    return pDate >= startOfDay;
                });

                // Calculate today metrics
                const todayMoney = todayPayments.reduce((s, p) => s + p.amount, 0);

                // Count tickets sold today (sold via saleDate)
                let ticketsSoldToday = 0;
                ticketsSnap.docs.forEach(d => {
                    const t = d.data();
                    if (t.saleDate) {
                        const saleDate = t.saleDate.toDate?.() || new Date(t.saleDate.seconds * 1000);
                        if (saleDate >= startOfDay) ticketsSoldToday++;
                    }
                });

                // Top method today
                const methodCounts = new Map<string, number>();
                todayPayments.forEach(p => methodCounts.set(p.method, (methodCounts.get(p.method) || 0) + 1));
                const topMethod = Array.from(methodCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

                // Top vendor today
                const vendorAmounts = new Map<string, number>();
                todayPayments.forEach(p => vendorAmounts.set(p.vendorId, (vendorAmounts.get(p.vendorId) || 0) + p.amount));
                const topVendorId = Array.from(vendorAmounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
                const topVendor = topVendorId ? (vMap.get(topVendorId) || "—") : "—";

                setTodayMetrics({
                    ticketsSold: ticketsSoldToday,
                    moneyCollected: todayMoney,
                    paymentsCount: todayPayments.length,
                    topMethod,
                    topVendor,
                    recentPayments: todayPayments.slice(0, 8),
                });
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, activeRaffle, commissionRate]);

    if (!activeRaffle) return null;

    const soldTotal = metrics ? metrics.sold + metrics.paid + metrics.installment : 0;
    const progressPercent = metrics ? Math.round((soldTotal / metrics.totalTickets) * 100) : 0;

    return (
        <div>
            <PageHeader
                title={activeRaffle.name}
                description="Panel de administración"
                actions={
                    <Link href="/raffles">
                        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Cambiar Rifa</Button>
                    </Link>
                }
            />

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <StatusBadge status={activeRaffle.status} />
                <span className="text-sm text-default-500">
                    {activeRaffle.totalTickets.toLocaleString()} boletas × {formatCurrency(activeRaffle.ticketPrice)}
                </span>
            </div>

            {loading ? (
                <LoadingSkeleton rows={10} />
            ) : (
                <div className="space-y-8">
                    {/* === TODAY SECTION === */}
                    {todayMetrics && (
                        <section>
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Zap className="h-5 w-5 text-amber-400" /> Actividad de hoy
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                                <StatCard title="Boletas vendidas hoy" value={todayMetrics.ticketsSold} icon={<Calendar className="h-5 w-5" />} />
                                <StatCard title="Recaudado hoy" value={formatCurrency(todayMetrics.moneyCollected)} icon={<DollarSign className="h-5 w-5" />} />
                                <StatCard title="Abonos registrados" value={todayMetrics.paymentsCount} icon={<CreditCard className="h-5 w-5" />} />
                                <StatCard title="Mejor vendedor hoy" value={todayMetrics.topVendor} icon={<TrendingUp className="h-5 w-5" />} />
                            </div>

                            {todayMetrics.topMethod !== "—" && (
                                <div className="mb-4 flex items-center gap-2 text-sm text-default-500">
                                    <span>Método más usado hoy:</span>
                                    <PaymentMethodBadge method={todayMetrics.topMethod} />
                                </div>
                            )}

                            {/* Recent payments feed */}
                            {todayMetrics.recentPayments.length > 0 && (
                                <Card>
                                    <CardContent className="p-4">
                                        <h3 className="text-sm font-semibold mb-3">Últimos movimientos</h3>
                                        <div className="space-y-2">
                                            {todayMetrics.recentPayments.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between py-2 border-b border-default-100 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-xs font-bold">#{p.ticketId}</span>
                                                        <span className="text-xs text-default-500">{customersMap.get(p.customerId) || "—"}</span>
                                                        <PaymentMethodBadge method={p.method} />
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-semibold">{formatCurrency(p.amount)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {todayMetrics.recentPayments.length === 0 && todayMetrics.paymentsCount === 0 && (
                                <Card>
                                    <CardContent className="p-6 text-center">
                                        <p className="text-default-400 text-sm">Sin movimientos hoy</p>
                                    </CardContent>
                                </Card>
                            )}
                        </section>
                    )}

                    <Separator />

                    {/* === GENERAL SECTION === */}
                    {metrics && (
                        <section>
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" /> Resumen general
                            </h2>

                            {/* Financial */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                                <StatCard title="Recaudado" value={formatCurrency(metrics.totalCollected)} icon={<DollarSign className="h-5 w-5" />} />
                                <StatCard title="Pendiente por cobrar" value={formatCurrency(metrics.totalPending)} icon={<CreditCard className="h-5 w-5" />} />
                                <StatCard title="Ganancia empresa" value={formatCurrency(metrics.companyProfit)} icon={<TrendingUp className="h-5 w-5" />} />
                                <StatCard title="Comisión vendedores" value={formatCurrency(metrics.commissionGenerated)} icon={<Percent className="h-5 w-5" />} />
                            </div>

                                {/* Revenue by payment method */}
                                <h3 className="text-sm font-semibold mb-3 mt-6">Recaudado por medio de pago</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                    <StatCard title="Efectivo" value={formatCurrency(methodTotals["cash"] || 0)} icon={<DollarSign className="h-5 w-5" />} />
                                    <StatCard title="Nequi" value={formatCurrency(methodTotals["nequi"] || 0)} icon={<CreditCard className="h-5 w-5" />} />
                                    <StatCard title="Daviplata" value={formatCurrency(methodTotals["daviplata"] || 0)} icon={<CreditCard className="h-5 w-5" />} />
                                    <StatCard title="Bancolombia Ahorros" value={formatCurrency(methodTotals["transfer"] || 0)} icon={<CreditCard className="h-5 w-5" />} />
                                </div>

                                {/* People */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                    <StatCard title="Vendedores" value={metrics.vendorsCount} icon={<Users className="h-5 w-5" />} />
                                    <StatCard title="Clientes" value={metrics.customersCount} icon={<Users className="h-5 w-5" />} />
                                    <StatCard title="Potencial total" value={formatCurrency(metrics.totalPotential)} icon={<DollarSign className="h-5 w-5" />} />
                                    <StatCard title="% Vendido" value={`${progressPercent}%`} icon={<TrendingUp className="h-5 w-5" />} />
                                </div>

                                {/* Ticket status grid */}
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                                    <MiniStat label="Disponibles" value={metrics.available} color="text-zinc-400" />
                                    <MiniStat label="Asignadas" value={metrics.assigned} color="text-amber-400" />
                                    <MiniStat label="Vendidas" value={metrics.sold} color="text-blue-400" />
                                    <MiniStat label="Pagadas" value={metrics.paid} color="text-emerald-400" />
                                    <MiniStat label="Abonadas" value={metrics.installment} color="text-purple-400" />
                                </div>

                                {/* Progress bar */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                            <span className="text-sm font-medium">Progreso de venta</span>
                                            <span className="text-sm text-default-500">
                                                {soldTotal} de {metrics.totalTickets} boletas vendidas ({progressPercent}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-4 bg-default-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>
                        )}
                    </div>
            )}
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <Card>
            <CardContent className="p-3 text-center">
                <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] sm:text-xs text-default-500 mt-1">{label}</p>
            </CardContent>
        </Card>
    );
}
