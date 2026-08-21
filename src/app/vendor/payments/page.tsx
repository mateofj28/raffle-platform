"use client";

import { useEffect, useState } from "react";
import { Button, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { CreditCard, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

const TYPE_LABELS: Record<string, string> = { payment: "Pago", installment: "Abono" };

const MONTHS = [
    { id: "", label: "Todos los meses" },
    { id: "1", label: "Enero" },
    { id: "2", label: "Febrero" },
    { id: "3", label: "Marzo" },
    { id: "4", label: "Abril" },
    { id: "5", label: "Mayo" },
    { id: "6", label: "Junio" },
    { id: "7", label: "Julio" },
    { id: "8", label: "Agosto" },
    { id: "9", label: "Septiembre" },
    { id: "10", label: "Octubre" },
    { id: "11", label: "Noviembre" },
    { id: "12", label: "Diciembre" },
];

export default function VendorPaymentsPage() {
    const user = useAuthStore((s) => s.user);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

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
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [user?.tenantId, user?.vendorId]);

    // Apply filters
    const filtered = payments.filter(p => {
        if (searchTicket && !p.ticketId.includes(searchTicket)) return false;
        if (filterType && p.type !== filterType) return false;
        if (filterMethod && p.method !== filterMethod) return false;
        if (filterMonth) {
            if (!p.createdAt) return false;
            const pDate = typeof p.createdAt === "string" ? new Date(p.createdAt) : (p.createdAt as any).toDate?.() || new Date((p.createdAt as any).seconds * 1000);
            if ((pDate.getMonth() + 1) !== parseInt(filterMonth)) return false;
        }
        return true;
    });

    const hasFilters = searchTicket || filterType || filterMethod || filterMonth;
    const clearFilters = () => { setSearchTicket(""); setFilterType(""); setFilterMethod(""); setFilterMonth(""); };

    if (loading) return <div><PageHeader title="Mis Pagos" /><LoadingSkeleton rows={6} /></div>;

    return (
        <div>
            <PageHeader title="Mis Pagos" description="Historial de pagos y abonos registrados por ti" />

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
                            />
                            <Select
                                aria-label="Mes"
                                selectedKey={filterMonth || null}
                                onSelectionChange={(key) => setFilterMonth(key ? String(key) : "")}
                                placeholder="Mes"
                                className="w-40"
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                    <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                </SelectTrigger>
                                <SelectPopover>
                                    <ListBox>
                                        {MONTHS.map(m => (
                                            <ListBoxItem key={m.id} id={m.id} textValue={m.label}>{m.label}</ListBoxItem>
                                        ))}
                                    </ListBox>
                                </SelectPopover>
                            </Select>
                            <Select
                                aria-label="Tipo"
                                selectedKey={filterType || null}
                                onSelectionChange={(key) => setFilterType(key ? String(key) : "")}
                                placeholder="Tipo"
                                className="w-36"
                            >
                                <SelectTrigger>
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
                                <SelectTrigger>
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
                                        <ListBoxItem id="other" textValue="Otro">Otro</ListBoxItem>
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
                                            <td className="px-4 py-3 text-xs text-default-500">
                                                {payment.createdAt ? formatDateTime(payment.createdAt) : "—"}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold">{payment.ticketId}</td>
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
