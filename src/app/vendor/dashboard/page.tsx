"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Separator } from "@heroui/react";
import { DollarSign, TrendingUp, Wallet, Ticket, Zap, Calendar } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Ticket as TicketType, Payment } from "@/types/api.types";

export default function VendorDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        assigned: 0,
        sold: 0,
        paid: 0,
        installment: 0,
        totalCollected: 0,
        commission: 0,
        toDeliver: 0,
    });
    const [todayMetrics, setTodayMetrics] = useState({
        sold: 0,
        paid: 0,
        installment: 0,
        collected: 0,
    });

    useEffect(() => {
        if (!user?.tenantId || !user?.vendorId) return;
        const load = async () => {
            setLoading(true);
            try {
                // Find active raffle
                const rafflesCol = tenantCollection(user.tenantId, "raffles");
                const rafflesQ = query(rafflesCol, where("status", "in", ["active", "draft"]), orderBy("createdAt", "desc"));
                const rafflesSnap = await getDocs(rafflesQ);

                if (rafflesSnap.empty) {
                    setLoading(false);
                    return;
                }

                const activeRaffle = rafflesSnap.docs[0];
                const raffleId = activeRaffle.id;

                // Load my tickets
                const ticketsCol = tenantCollection(user.tenantId, `raffles/${raffleId}/tickets`);
                const ticketsQ = query(ticketsCol, where("vendorId", "==", user.vendorId));
                const ticketsSnap = await getDocs(ticketsQ);
                const tickets = ticketsSnap.docs.map(d => d.data()) as TicketType[];

                let assigned = 0, sold = 0, paid = 0, installment = 0;
                let totalCollected = 0;

                tickets.forEach(t => {
                    switch (t.status) {
                        case "assigned": assigned++; break;
                        case "sold": sold++; break;
                        case "paid": paid++; break;
                        case "installment": installment++; break;
                    }
                    totalCollected += (t.value - t.pendingBalance);
                });

                const commission = Math.floor(totalCollected * 0.30);
                const toDeliver = totalCollected - commission;

                setMetrics({ assigned, sold, paid, installment, totalCollected, commission, toDeliver });

                // Load today's payments for this vendor
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                const paymentsCol = tenantCollection(user.tenantId, "payments");
                const paymentsQ = query(paymentsCol, where("vendorId", "==", user.vendorId), where("raffleId", "==", raffleId), orderBy("createdAt", "desc"));
                const paymentsSnap = await getDocs(paymentsQ);
                const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[];

                const todayPayments = allPayments.filter(p => {
                    if (!p.createdAt) return false;
                    const pDate = typeof p.createdAt === "string" ? new Date(p.createdAt) : (p.createdAt as any).toDate?.() || new Date((p.createdAt as any).seconds * 1000);
                    return pDate >= startOfDay;
                });

                // Today: count by type
                let todaySold = 0, todayPaid = 0, todayInstallment = 0, todayCollected = 0;
                todayPayments.forEach(p => {
                    if (p.type === "payment") todayPaid++;
                    else todayInstallment++;
                    todayCollected += p.amount;
                });

                // Today tickets sold (saleDate today)
                tickets.forEach(t => {
                    if (t.saleDate) {
                        const saleDate = typeof t.saleDate === "string" ? new Date(t.saleDate) : (t.saleDate as any).toDate?.() || new Date((t.saleDate as any).seconds * 1000);
                        if (saleDate >= startOfDay) todaySold++;
                    }
                });

                setTodayMetrics({ sold: todaySold, paid: todayPaid, installment: todayInstallment, collected: todayCollected });
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [user?.tenantId, user?.vendorId]);

    if (loading) return <div><PageHeader title="Mi Panel" /><LoadingSkeleton rows={8} /></div>;

    return (
        <div>
            <PageHeader title="Mi Panel" description="Resumen de tu actividad" />

            <div className="space-y-8">
                {/* === TODAY === */}
                <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-400" /> Hoy
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <StatCard title="Boletas vendidas" value={todayMetrics.sold} icon={<Calendar className="h-5 w-5" />} />
                        <StatCard title="Pagos completos" value={todayMetrics.paid} icon={<DollarSign className="h-5 w-5" />} />
                        <StatCard title="Abonos registrados" value={todayMetrics.installment} icon={<Wallet className="h-5 w-5" />} />
                        <StatCard title="Recaudado hoy" value={formatCurrency(todayMetrics.collected)} icon={<TrendingUp className="h-5 w-5" />} />
                    </div>
                </section>

                <Separator />

                {/* === GENERAL === */}
                <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" /> Resumen general
                    </h2>

                    {/* Ticket counts */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <MiniStat label="Asignadas" value={metrics.assigned} color="text-amber-400" />
                        <MiniStat label="Vendidas" value={metrics.sold} color="text-blue-400" />
                        <MiniStat label="Pagadas" value={metrics.paid} color="text-emerald-400" />
                        <MiniStat label="Abonadas" value={metrics.installment} color="text-purple-400" />
                    </div>

                    {/* Financial */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard title="Total recaudado" value={formatCurrency(metrics.totalCollected)} icon={<DollarSign className="h-5 w-5" />} />
                        <StatCard title="Mi comisión (30%)" value={formatCurrency(metrics.commission)} icon={<TrendingUp className="h-5 w-5" />} />
                        <StatCard title="Debo entregar" value={formatCurrency(metrics.toDeliver)} icon={<Wallet className="h-5 w-5" />} />
                    </div>
                </section>
            </div>
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
