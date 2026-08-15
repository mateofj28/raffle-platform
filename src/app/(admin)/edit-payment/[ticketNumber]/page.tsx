"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, Input, AlertDialog } from "@heroui/react";
import { ArrowLeft, DollarSign, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" };

export default function EditPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const ticketNumber = parseInt(params.ticketNumber as string);
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { activeRaffle } = useRaffleStore();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
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

  const handleCorrectPayment = async () => {
    if (!editingPayment || !activeRaffle || !newAmount) return;
    const newAmountNum = parseInt(newAmount);
    if (newAmountNum < 5000) return;

    setProcessing(true);
    setError(null);
    try {
      // 1. Reverse the original payment
      await callFunction("reversePayment", {
        paymentId: editingPayment.id,
        amount: editingPayment.amount,
        reason: `Corrección: monto original $${editingPayment.amount.toLocaleString()} → nuevo monto $${newAmountNum.toLocaleString()}`,
      });

      // 2. Register the new correct payment
      await callFunction("registerPayment", {
        raffleId: activeRaffle.id,
        ticketNumber,
        amount: newAmountNum,
        type: editingPayment.type,
        method: editingPayment.method,
        observations: `Corrección del pago anterior (era $${editingPayment.amount.toLocaleString()})`,
      });

      setSuccess(`Pago corregido: ${formatCurrency(editingPayment.amount)} → ${formatCurrency(newAmountNum)}`);
      setEditingPayment(null);
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

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Corregir pagos — Boleta #${ticketNumber}`}
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

      {loading ? (
        <p className="text-default-500">Cargando pagos...</p>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-default-500">Esta boleta no tiene pagos registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-default-500 mb-4">Selecciona el pago que deseas corregir:</p>

          {payments.map((payment) => (
            <Card key={payment.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${payment.type === "payment" ? "text-success" : "text-amber-400"}`}>
                        {formatCurrency(payment.amount)}
                      </span>
                      <span className="text-xs text-default-500">
                        {payment.type === "payment" ? "Pago completo" : "Abono"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-default-500">
                      <span>{METHOD_LABELS[payment.method] || payment.method}</span>
                      <span>{formatDateTime(payment.createdAt)}</span>
                    </div>
                    {payment.observations && (
                      <p className="text-xs text-default-400 italic">{payment.observations}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onPress={() => { setEditingPayment(payment); setNewAmount(String(payment.amount)); }}>
                    <Pencil className="h-4 w-4 text-amber-400" /> Corregir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AlertDialog.Backdrop isOpen={editingPayment !== null} onOpenChange={(open) => { if (!open) { setEditingPayment(null); setNewAmount(""); } }} isDismissable>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>Corregir monto</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-default-500 mb-4">
                Monto actual: <span className="font-semibold text-foreground">{editingPayment ? formatCurrency(editingPayment.amount) : ""}</span>
              </p>
              <label className="text-sm font-medium mb-2 block">Nuevo monto correcto</label>
              <Input
                type="text"
                placeholder="Ej: 45.000"
                value={newAmount ? parseInt(newAmount).toLocaleString("es-CO") : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setNewAmount(raw);
                }}
                className="w-full"
                inputMode="numeric"
              />
              {newAmount && parseInt(newAmount) < 5000 && (
                <p className="text-xs text-danger mt-1">Mínimo: $5.000</p>
              )}
              {newAmount && parseInt(newAmount) >= 5000 && (
                <p className="text-xs text-default-500 mt-1">
                  Cambio: {editingPayment ? formatCurrency(editingPayment.amount) : ""} → {formatCurrency(parseInt(newAmount))}
                </p>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">Cancelar</Button>
              <Button variant="primary" isDisabled={!newAmount || parseInt(newAmount) < 5000 || processing} onPress={handleCorrectPayment}>
                {processing ? "Corrigiendo..." : "Confirmar corrección"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
