"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@heroui/react";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy, limit, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, string> = { payment: "Pago", installment: "Abono" };

export default function VendorPaymentsPage() {
    const user = useAuthStore((s) => s.user);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);

    const loadPage = async (isFirst = false) => {
        if (!user?.tenantId || !user?.vendorId) return;

        if (isFirst) setLoading(true);
        else setLoadingMore(true);

        try {
            const col = tenantCollection(user.tenantId, "payments");
            let q;

            if (isFirst || !lastDocRef.current) {
                q = query(col, where("vendorId", "==", user.vendorId), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
            } else {
                q = query(col, where("vendorId", "==", user.vendorId), orderBy("createdAt", "desc"), startAfter(lastDocRef.current), limit(PAGE_SIZE));
            }

            const snap = await getDocs(q);
            const newPayments = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[];

            if (isFirst) {
                setPayments(newPayments);
            } else {
                setPayments(prev => [...prev, ...newPayments]);
            }

            lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch (e) { console.error(e); }
        finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        lastDocRef.current = null;
        loadPage(true);
    }, [user?.tenantId, user?.vendorId]);

    if (loading) return <div><PageHeader title="Pagos" /><LoadingSkeleton rows={6} /></div>;

    return (
        <div>
            <PageHeader title="Mis Pagos" description="Historial de pagos y abonos registrados por ti" />

            {payments.length === 0 ? (
                <EmptyState title="Sin pagos" description="Aún no has registrado pagos" icon={<CreditCard className="h-12 w-12" />} />
            ) : (
                <>
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
                                    {payments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-default-50">
                                            <td className="px-4 py-3 text-xs text-default-500">
                                                {payment.createdAt ? formatDateTime(payment.createdAt) : "—"}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold">{payment.ticketId}</td>
                                            <td className="px-4 py-3">
                                                <span className={payment.type === "payment" ? "text-success" : "text-amber-400"}>
                                                    {TYPE_LABELS[payment.type] || payment.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3"><PaymentMethodBadge method={payment.method} /></td>
                                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                            <p className="text-xs text-default-500">
                                Mostrando {payments.length} pagos
                            </p>
                            {hasMore && (
                                <Button variant="outline" size="sm" isDisabled={loadingMore} onPress={() => loadPage(false)}>
                                    {loadingMore ? "Cargando..." : "Cargar más"}
                                </Button>
                            )}
                        </div>
                </>
            )}
        </div>
    );
}
