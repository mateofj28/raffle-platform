"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

export default function VendorPaymentsPage() {
    const user = useAuthStore((s) => s.user);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

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

    const totalPages = Math.ceil(payments.length / PAGE_SIZE);
    const paginatedPayments = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (loading) return <div><PageHeader title="Pagos" /><LoadingSkeleton rows={6} /></div>;

    const TYPE_LABELS: Record<string, string> = { payment: "Pago", installment: "Abono" };
    const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" };

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
                              {paginatedPayments.map((payment) => (
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
                                      <td className="px-4 py-3 text-default-600">{METHOD_LABELS[payment.method] || payment.method}</td>
                                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                          <p className="text-xs text-default-500">
                              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, payments.length)} de {payments.length}
                          </p>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="sm" isDisabled={page === 1} onPress={() => setPage(p => p - 1)}>Anterior</Button>
                              <Button variant="ghost" size="sm" isDisabled={page === totalPages} onPress={() => setPage(p => p + 1)}>Siguiente</Button>
                          </div>
                      </div>
                  )}
              </>
          )}
      </div>
  );
}
