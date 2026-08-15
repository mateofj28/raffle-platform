"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, Input } from "@heroui/react";
import { ArrowLeft, DollarSign, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

export default function CorrectPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const ticketNumber = parseInt(params.ticketNumber as string);
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { activeRaffle } = useRaffleStore();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRaffle) router.push("/raffles");
  }, [activeRaffle, router]);

  // Load payments for this ticket
  useEffect(() => {
    if (!tenantId || !activeRaffle) return;
    const load = async () => {
      setLoading(true);
      try {
        const padded = String(ticketNumber).padStart(5, "0");
        const col = tenantCollection(tenantId, "payments");
        const q = query(col, where("ticketId", "==", padded), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [tenantId, activeRaffle, ticketNumber]);

  const handleCorrect = async (paymentId: string) => {
    const amount = parseInt(newAmount || "0");
    if (amount < 5000) {
      setError("El monto mínimo es $5.000");
      return;
    }
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      await callFunction("correctPayment", {
        paymentId,
        newAmount: amount,
        reason: "Corrección manual por admin",
      });
      setSuccess("Monto corregido exitosamente");
      setEditingId(null);
      setNewAmount("");
      // Reload payments
      const padded = String(ticketNumber).padStart(5, "0");
      const col = tenantCollection(tenantId!, "payments");
      const q = query(col, where("ticketId", "==", padded), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al corregir el pago");
    } finally {
      setProcessing(false);
    }
  };

  if (!activeRaffle) return null;

  const TYPE_LABELS: Record<string, string> = { payment: "Pago completo", installment: "Abono" };
  const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Corregir abono — Boleta #${ticketNumber}`}
        description={`Rifa: ${activeRaffle.name}`}
        actions={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        }
      />

      <FormErrorBanner message={error} />
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm">{success}</div>
      )}

      {loading ? <LoadingSkeleton rows={4} /> : payments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-default-500">Esta boleta no tiene pagos registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <Card key={payment.id} className={editingId === payment.id ? "border-2 border-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-lg">{formatCurrency(payment.amount)}</span>
                      <span className={`text-xs ${payment.type === "payment" ? "text-success" : "text-amber-400"}`}>
                        {TYPE_LABELS[payment.type] || payment.type}
                      </span>
                      <span className="text-xs text-default-500">{METHOD_LABELS[payment.method] || payment.method}</span>
                    </div>
                    <p className="text-xs text-default-500">{formatDateTime(payment.createdAt)}</p>
                    {payment.observations && <p className="text-xs text-default-400 mt-1">{payment.observations}</p>}
                  </div>
                  {editingId !== payment.id && (
                    <Button variant="ghost" size="sm" onPress={() => { setEditingId(payment.id); setNewAmount(String(payment.amount)); setError(null); setSuccess(null); }}>
                      <Pencil className="h-4 w-4 text-amber-400" />
                    </Button>
                  )}
                </div>

                {/* Edit mode */}
                {editingId === payment.id && (
                  <div className="mt-4 pt-4 border-t border-default-200">
                    <label className="text-sm font-medium mb-2 block">Nuevo monto</label>
                    <Input
                      type="text"
                      placeholder="Ej: 45.000"
                      value={newAmount ? parseInt(newAmount).toLocaleString("es-CO") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setNewAmount(raw);
                      }}
                      className="w-full mb-2"
                      inputMode="numeric"
                    />
                    {newAmount && parseInt(newAmount) >= 5000 && (
                      <p className="text-xs text-default-500 mb-3">
                        Cambiar de {formatCurrency(payment.amount)} → {formatCurrency(parseInt(newAmount))}
                      </p>
                    )}
                    {newAmount && parseInt(newAmount) < 5000 && (
                      <p className="text-xs text-danger mb-3">Mínimo: $5.000</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onPress={() => { setEditingId(null); setNewAmount(""); }}>Cancelar</Button>
                      <Button variant="primary" size="sm" isDisabled={processing || !newAmount || parseInt(newAmount) < 5000} onPress={() => handleCorrect(payment.id)}>
                        {processing ? "Corrigiendo..." : "Corregir monto"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
