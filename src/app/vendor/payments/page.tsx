"use client";

import { useEffect, useState } from "react";
import { Button, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { CreditCard, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTimeParts, formatTicketNumbers } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import { pairingService } from "@/features/raffles/services/pairing.service";
import type { Payment } from "@/types/api.types";

const TYPE_LABELS: Record<string, string> = { payment: "Pago", installment: "Abono" };

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function VendorPaymentsPage() {
    const user = useAuthStore((s) => s.user);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDark, setIsDark] = useState(false);
    const [pairsByBase, setPairsByBase] = useState<Map<number, number[]>>(new Map());
    // raffleId → numbersPerTicket. Solo las rifas de 2 números usan parejas.
    const [raffleNums, setRaffleNums] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    const grayField = isDark ? undefined : { backgroundColor: "#F3F4F6", borderColor: "#F3F4F6" };

    // Filters
    const [searchTicket, setSearchTicket] = useState("");
    const [filterType, setFilterType] = useState("");
    const [filterMethod, setFilterMethod] = useState("");
    const [filterMonth, setFilterMonth] = useState("");

    useEffect(() => {
        if (!user?.tenantId || !user?.vendorId) return;
        const load = async () => {
            setLoading(true);
            try {
                const col = tenantCollection(user.tenantId, "payments");
                const q = query(col, where("vendorId", "==", user.vendorId), orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);

                // Mapa raffleId → numbersPerTicket: para saber, por cada pago, si su
                // rifa es de 2 números (y solo ahí mostrar la pareja).
                const rafflesSnap = await getDocs(tenantCollection(user.tenantId, "raffles"));
                const nums = new Map<string, number>();
                rafflesSnap.docs.forEach((d) => nums.set(d.id, (d.data().numbersPerTicket as number) ?? 1));
                setRaffleNums(nums);

                // Parejas del tenant (aplican solo a rifas de 2 números).
                try {
                    const res = await pairingService.get();
                    if (res.pairs && res.pairs.length > 0) {
                        const pMap = new Map<number, number[]>();
                        res.pairs.forEach(([a, b]) => { pMap.set(Math.min(a, b), [Math.min(a, b), Math.max(a, b)]); });
                        setPairsByBase(pMap);
                    }
                } catch { /* rifas de 1 número: sin parejas */ }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [user?.tenantId, user?.vendorId]);

    // Etiqueta de la boleta de un pago: pareja "0000 · 1111" SOLO si la rifa del
    // pago es de 2 números; si es de 1 número, muestra el número base solo.
    const ticketLabel = (ticketId: string, raffleId?: string): string => {
        const base = parseInt(ticketId, 10);
        const isPairRaffle = raffleId ? raffleNums.get(raffleId) === 2 : false;
        return formatTicketNumbers(isPairRaffle ? pairsByBase.get(base) : undefined, base);
    };

    // Fecha de un pago (Timestamp de Firestore o string) a Date.
    const paymentDate = (p: Payment): Date | null => {
        const c = p.createdAt as unknown;
        if (!c) return null;
        if (typeof c === "string") { const d = new Date(c); return isNaN(d.getTime()) ? null : d; }
        const anyC = c as { toDate?: () => Date; seconds?: number };
        if (typeof anyC.toDate === "function") return anyC.toDate();
        if (typeof anyC.seconds === "number") return new Date(anyC.seconds * 1000);
        return null;
    };

    // Meses (con pagos) disponibles para el filtro, más recientes primero.
    // Solo se listan los meses que REALMENTE tienen pagos (clave "YYYY-M").
    const monthOptions = Array.from(
        new Set(payments.map((p) => { const d = paymentDate(p); return d ? `${d.getFullYear()}-${d.getMonth()}` : null; }).filter(Boolean) as string[])
    )
        .sort((a, b) => (a < b ? 1 : -1))
        .map((key) => { const [y, m] = key.split("-").map(Number); return { key, label: `${MONTH_NAMES[m]} ${y}` }; });

    // Apply filters
    const filtered = payments.filter(p => {
        if (searchTicket && !p.ticketId.includes(searchTicket) && !ticketLabel(p.ticketId, p.raffleId).toLowerCase().includes(searchTicket.toLowerCase())) return false;
        if (filterType && p.type !== filterType) return false;
        if (filterMethod && p.method !== filterMethod) return false;
        if (filterMonth) {
            const d = paymentDate(p);
            if (!d) return false;
            const [y, m] = filterMonth.split("-").map(Number);
            if (d.getFullYear() !== y || d.getMonth() !== m) return false;
        }
        return true;
    });

    const hasFilters = searchTicket || filterType || filterMethod || filterMonth;
    const clearFilters = () => { setSearchTicket(""); setFilterType(""); setFilterMethod(""); setFilterMonth(""); };

    if (loading) return <div><PageHeader title="Mis Pagos" /><LoadingSkeleton rows={6} /></div>;

    return (
        <div>
            <PageHeader title="Mis Pagos" description="Historial de pagos y abonos de tus boletas" />

            {payments.length === 0 ? (
                <EmptyState title="Sin pagos" description="Aún no has registrado pagos" icon={<CreditCard className="h-12 w-12" />} />
            ) : (
                <>
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <Input
                                placeholder="Buscar por # boleta..."
                                value={searchTicket}
                                onChange={(e) => setSearchTicket(e.target.value.replace(/\D/g, "").padStart(e.target.value.length, "0"))}
                                className="w-40"
                                inputMode="numeric"
                                style={grayField}
                            />
                            {/* Filtro por mes: solo aparece si hay pagos en 2+ meses,
                                y solo lista los meses que realmente tienen pagos. */}
                            {monthOptions.length >= 2 && (
                                <Select
                                    aria-label="Mes"
                                    selectedKey={filterMonth || null}
                                    onSelectionChange={(key) => setFilterMonth(key ? String(key) : "")}
                                    placeholder="Mes"
                                    className="w-44"
                                >
                                    <SelectTrigger style={grayField}>
                                        <SelectValue />
                                        <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                    </SelectTrigger>
                                    <SelectPopover>
                                        <ListBox>
                                            <ListBoxItem id="" textValue="Todos los meses">Todos los meses</ListBoxItem>
                                            {monthOptions.map((m) => (
                                                <ListBoxItem key={m.key} id={m.key} textValue={m.label}>{m.label}</ListBoxItem>
                                            ))}
                                        </ListBox>
                                    </SelectPopover>
                                </Select>
                            )}
                            <Select
                                aria-label="Tipo"
                                selectedKey={filterType || null}
                                onSelectionChange={(key) => setFilterType(key ? String(key) : "")}
                                placeholder="Tipo"
                                className="w-36"
                            >
                                <SelectTrigger style={grayField}>
                                    <SelectValue />
                                    <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                </SelectTrigger>
                                <SelectPopover>
                                    <ListBox>
                                        <ListBoxItem id="" textValue="Todos">Todos</ListBoxItem>
                                        <ListBoxItem id="payment" textValue="Pago">Pago</ListBoxItem>
                                        <ListBoxItem id="installment" textValue="Abono">Abono</ListBoxItem>
                                    </ListBox>
                                </SelectPopover>
                            </Select>
                            <Select
                                aria-label="Método"
                                selectedKey={filterMethod || null}
                                onSelectionChange={(key) => setFilterMethod(key ? String(key) : "")}
                                placeholder="Método"
                                className="w-44"
                            >
                                <SelectTrigger style={grayField}>
                                    <SelectValue />
                                    <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                </SelectTrigger>
                                <SelectPopover>
                                    <ListBox>
                                        <ListBoxItem id="" textValue="Todos">Todos</ListBoxItem>
                                        <ListBoxItem id="cash" textValue="Efectivo">Efectivo</ListBoxItem>
                                        <ListBoxItem id="nequi" textValue="Nequi">Nequi</ListBoxItem>
                                        <ListBoxItem id="daviplata" textValue="Daviplata">Daviplata</ListBoxItem>
                                        <ListBoxItem id="transfer" textValue="Bancolombia">Bancolombia</ListBoxItem>
                                    </ListBox>
                                </SelectPopover>
                            </Select>
                            {hasFilters && (
                                <Button variant="ghost" size="sm" onPress={clearFilters}>✕ Limpiar</Button>
                            )}
                            <span className="text-xs text-default-500 ml-auto">{filtered.length} pagos</span>
                        </div>

                        {/* Table */}
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <CreditCard className="h-8 w-8 text-default-400 mb-2" />
                                <p className="text-sm text-default-600">Sin resultados</p>
                                <p className="text-xs text-default-400">No hay pagos que coincidan con los filtros</p>
                            </div>
                        ) : (
                                <div className="overflow-x-auto rounded-lg border border-default-200">
                                    <table className="w-full text-sm">
                                        <thead className="bg-default-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                                                <th className="px-4 py-3 text-left font-medium">Boleta</th>
                                                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                                                <th className="px-4 py-3 text-left font-medium">Método</th>
                                                <th className="px-4 py-3 text-right font-medium">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-default-200">
                                            {filtered.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-default-50">
                                                    <td className="px-4 py-3 text-xs text-default-500 whitespace-nowrap">
                                                        {(() => {
                                                            if (!payment.createdAt) return "—";
                                                            const { date, time } = formatDateTimeParts(payment.createdAt);
                                                            return (<><span className="block text-foreground">{date}</span><span className="block text-default-400">{time}</span></>);
                                                        })()}
                                            </td>
                                                    <td className="px-4 py-3 font-mono font-bold">{ticketLabel(payment.ticketId, payment.raffleId)}</td>
                                            <td className="px-4 py-3">
                                                <span className={payment.type === "payment" ? "text-emerald-500 font-medium" : "text-amber-400 font-medium"}>
                                                    {TYPE_LABELS[payment.type] || payment.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3"><PaymentMethodBadge method={payment.method} /></td>
                                            <td className="px-4 py-3 text-right font-semibold text-emerald-500">{formatCurrency(payment.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                                </div>
                        )}
                </>
            )}
        </div>
    );
}
