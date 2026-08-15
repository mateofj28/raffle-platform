"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, Input, AlertDialog, Separator } from "@heroui/react";
import { ArrowLeft, Pencil, Trash2, DollarSign, Calendar, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

const TYPE_LABELS: Record<string, string> = { payment: "Pago completo", installment: "Abono" };
const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" };

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  const ticketPrice = activeRaffle?.ticketPrice || 60000;

  useEffect(() => {
    if (!activeRaffle) router.push("/raffles");
  }, [activeRaffle, router]);

  const loadPayments = async () => {
    if (!tenantId) return;
    const padded = String(ticketNumber).padStart(5, "0");
    const col = tenantCollection(tenantId, "payments");
    const q = query(col, where("ticketId", "==", padded), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
  };

  useEffect(() => {
    if (!tenantId || !activeRaffle) return;
    setLoading(true);
    loadPayments().finally(() => setLoading(false));
  }, [tenantId, activeRaffle, ticketNumber]);

  const totalAbonado = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendiente = ticketPrice - totalAbonado;

  const handleCorrect = async (paymentId: string) => {
    const amount = parseInt(newAmount || "0");
    if (amount < 5000) { setError("El monto mínimo es $5.000"); return; }
    if (amount > ticketPrice) { setError(`Máximo: ${formatCurrency(ticketPrice)}`); return; }
    setProcessing(true); setError(null); setSuccess(null);
    try {
      await callFunction("correctPayment", { paymentId, newAmount: amount, reason: "Corrección manual" });
      setSuccess("✅ Monto corregido exitosamente");
      setEditingId(null); setNewAmount("");
      await loadPayments();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al corregir"); }
    finally { setProcessing(false); }
  };

  const handleDelete = async (paymentId: string) => {
    setProcessing(true); setError(null); setSuccess(null);
    try {
      const payment = payments.find(p => p.id === paymentId)!;
      await callFunction("reversePayment", { paymentId, amount: payment.amount, reason: "Eliminación por admin" });
      // Optimistic update: remove from local state immediately
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      setSuccess("✅ Abono eliminado");
      setDeleteConfirm(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Error al eliminar"); }
    finally { setProcessing(false); }
  };

  const handleDeleteAll = async () => {
    setProcessing(true); setError(null); setSuccess(null);
    try {
      for (const payment of payments) {
        await callFunction("reversePayment", { paymentId: payment.id, amount: payment.amount, reason: "Eliminación masiva" });
      }
      // Optimistic update: clear all payments from local state
      setPayments([]);
      setSuccess("✅ Todos los abonos eliminados");
      setDeleteAllConfirm(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setProcessing(false); }
  };

  if (!activeRaffle) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Boleta #${ticketNumber}`}
        description="Gestionar abonos y pagos"
        actions={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        }
      />

      <FormErrorBanner message={error} />
      {success && <div className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm">{success}</div>}

      {loading ? <LoadingSkeleton rows={4} /> : (
        <>
          {/* Summary Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs text-default-500 mb-1">Valor boleta</p>
                  <p className="text-xl font-bold">{formatCurrency(ticketPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-default-500 mb-1">Total abonado</p>
                  <p className="text-xl font-bold text-success">{formatCurrency(totalAbonado)}</p>
                </div>
                <div>
                  <p className="text-xs text-default-500 mb-1">Pendiente</p>
                  <p className={`text-xl font-bold ${pendiente === 0 ? "text-success" : "text-warning"}`}>{formatCurrency(pendiente)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="w-full h-2 bg-default-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-success to-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.min((totalAbonado / ticketPrice) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-default-500 mt-1 text-right">{Math.round((totalAbonado / ticketPrice) * 100)}% pagado</p>
              </div>
            </CardContent>
          </Card>

          {/* Payments list header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Pagos registrados ({payments.length})
            </h3>
            {payments.length > 1 && (
              <Button variant="ghost" size="sm" onPress={() => setDeleteAllConfirm(true)}>
                <Trash2 className="h-4 w-4 text-danger" /> Eliminar todos
              </Button>
            )}
          </div>

          {payments.length === 0 ? (
            <Card><CardContent className="p-8 text-center"><p className="text-default-500">Sin pagos registrados</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
                {payments.map((payment, index) => (
                  <Card key={payment.id} className={editingId === payment.id ? "border-2 border-primary" : ""}>
                    <CardContent className="p-5">
                      {/* Payment info row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Number badge */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-default-100 text-sm font-bold">
                            {payments.length - index}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <p className="text-2xl font-bold">{formatCurrency(payment.amount)}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              <span className={`text-xs font-medium ${payment.type === "payment" ? "text-success" : "text-amber-400"}`}>
                                {TYPE_LABELS[payment.type]}
                              </span>
                              <span className="text-xs text-default-500 flex items-center gap-1">
                                <PaymentMethodBadge method={payment.method} />
                              </span>
                              <span className="text-xs text-default-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formatDateTime(payment.createdAt)}
                              </span>
                            </div>
                            {payment.observations && (
                              <p className="text-xs text-default-400 mt-1 truncate">{payment.observations}</p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {editingId !== payment.id && (
                          <div className="flex flex-col gap-1">
                            <Button variant="ghost" size="sm" isIconOnly onPress={() => { setEditingId(payment.id); setNewAmount(String(payment.amount)); setError(null); setSuccess(null); }} aria-label="Editar">
                              <Pencil className="h-4 w-4 text-amber-400" />
                            </Button>
                            <Button variant="ghost" size="sm" isIconOnly onPress={() => setDeleteConfirm(payment.id)} aria-label="Eliminar">
                              <Trash2 className="h-4 w-4 text-danger" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Edit mode */}
                      {editingId === payment.id && (
                        <>
                          <Separator className="my-4" />
                          <div>
                            <label className="text-sm font-medium mb-2 block">Nuevo monto</label>
                            <Input
                              type="text"
                              placeholder="Ej: 45.000"
                              value={newAmount ? parseInt(newAmount).toLocaleString("es-CO") : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "");
                                const num = parseInt(raw || "0");
                                setNewAmount(num > ticketPrice ? String(ticketPrice) : raw);
                              }}
                              className="w-full"
                              inputMode="numeric"
                            />
                            <div className="flex items-center justify-between mt-2">
                              {newAmount && parseInt(newAmount) >= 5000 && (
                                <p className="text-xs text-default-500">{formatCurrency(payment.amount)} → {formatCurrency(parseInt(newAmount))}</p>
                              )}
                              {newAmount && parseInt(newAmount) < 5000 && (
                                <p className="text-xs text-danger">Mínimo: $5.000</p>
                              )}
                              {!newAmount && <p className="text-xs text-default-500">Máximo: {formatCurrency(ticketPrice)}</p>}
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button variant="ghost" size="sm" onPress={() => { setEditingId(null); setNewAmount(""); }}>Cancelar</Button>
                              <Button variant="primary" size="sm" isDisabled={processing || !newAmount || parseInt(newAmount) < 5000 || parseInt(newAmount) > ticketPrice} onPress={() => handleCorrect(payment.id)}>
                                {processing ? "Guardando..." : "Guardar cambio"}
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
          )}
        </>
      )}

      {/* Delete single */}
      <AlertDialog.Backdrop isOpen={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }} isDismissable>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Eliminar este abono?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Se revertirán <strong>{deleteConfirm ? formatCurrency(payments.find(p => p.id === deleteConfirm)?.amount || 0) : ""}</strong> y el saldo pendiente aumentará.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">Cancelar</Button>
              <Button variant="danger" isDisabled={processing} onPress={() => deleteConfirm && handleDelete(deleteConfirm)}>
                {processing ? "Eliminando..." : "Eliminar abono"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      {/* Delete all */}
      <AlertDialog.Backdrop isOpen={deleteAllConfirm} onOpenChange={(open) => { if (!open) setDeleteAllConfirm(false); }} isDismissable>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Eliminar TODOS los abonos?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Se revertirán <strong>{payments.length} pagos</strong> por un total de <strong>{formatCurrency(totalAbonado)}</strong>.</p>
              <p className="text-sm text-default-500 mt-2">La boleta volverá a tener saldo pendiente completo de {formatCurrency(ticketPrice)}.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">Cancelar</Button>
              <Button variant="danger" isDisabled={processing} onPress={handleDeleteAll}>
                {processing ? "Eliminando..." : "Eliminar todos"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
