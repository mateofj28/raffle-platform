"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, Input } from "@heroui/react";
import { ArrowLeft, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { getDoc, doc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";

export default function PayTicketPage() {
  const params = useParams();
  const router = useRouter();
  const ticketNumber = parseInt(params.ticketNumber as string);
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { activeRaffle } = useRaffleStore();

  const [pendingBalance, setPendingBalance] = useState(0);
  const [ticketValue, setTicketValue] = useState(0);
  const [paymentOption, setPaymentOption] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeRaffle) { router.push("/raffles"); return; }
    if (!tenantId) return;
    const load = async () => {
      try {
        const ticketDoc = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", activeRaffle.id, "tickets", String(ticketNumber).padStart(5, "0")));
        if (ticketDoc.exists()) {
          const data = ticketDoc.data();
          setPendingBalance(data.pendingBalance);
          setTicketValue(data.value);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [tenantId, activeRaffle, ticketNumber, router]);

  const handlePay = async () => {
    if (!activeRaffle) return;
    setPaying(true);
    setError(null);
    try {
      const payAmount = paymentOption === "full" ? pendingBalance : parseInt(amount);
      if (payAmount < 1000) { setError("Mínimo $1.000"); setPaying(false); return; }

      await callFunction("registerPayment", {
        raffleId: activeRaffle.id,
        ticketNumber,
        amount: payAmount,
        type: paymentOption === "full" ? "payment" : "installment",
        method: "cash",
        observations: paymentOption === "full" ? "Pago completo" : "Abono",
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar el pago");
    } finally {
      setPaying(false);
    }
  };

  if (!activeRaffle) return null;
  if (loading) return <div><PageHeader title="Abonar" /></div>;

  const amountPaid = ticketValue - pendingBalance;

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title={`Abonar boleta #${ticketNumber}`}
        description={`Rifa: ${activeRaffle.name}`}
        actions={<Button variant="ghost" size="sm" onPress={() => router.back()}><ArrowLeft className="h-4 w-4" /> Volver</Button>}
      />

      <FormErrorBanner message={error} />

      {/* Summary */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-default-500">Valor boleta</p>
              <p className="font-bold">{formatCurrency(ticketValue)}</p>
            </div>
            <div>
              <p className="text-xs text-default-500">Ya abonado</p>
              <p className="font-bold text-success">{formatCurrency(amountPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-default-500">Saldo pendiente</p>
              <p className="font-bold text-warning">{formatCurrency(pendingBalance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment options */}
      <Card className="mb-6">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" /> Tipo de pago
          </h3>

          <button
            type="button"
            onClick={() => setPaymentOption("full")}
            className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${paymentOption === "full" ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-default-200 hover:bg-default-50"}`}
          >
            <span className="font-semibold">Pagar todo el saldo</span>
            <span className="text-xs text-default-500 block mt-1">Paga {formatCurrency(pendingBalance)} y la boleta queda completamente pagada.</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentOption("partial")}
            className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${paymentOption === "partial" ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-default-200 hover:bg-default-50"}`}
          >
            <span className="font-semibold">Abono parcial</span>
            <span className="text-xs text-default-500 block mt-1">Paga una parte del saldo pendiente.</span>
          </button>

          {paymentOption === "partial" && (
            <div className="pl-4 border-l-2 border-amber-500/30 mt-3">
              <label className="text-sm font-medium mb-2 block">Monto del abono</label>
              <Input
                type="text"
                placeholder="Ej: 30.000"
                value={amount ? parseInt(amount).toLocaleString("es-CO") : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  const num = parseInt(raw || "0");
                  if (num >= pendingBalance) {
                    setAmount(String(pendingBalance));
                    setPaymentOption("full");
                  } else {
                    setAmount(raw);
                  }
                }}
                className="w-full"
                inputMode="numeric"
              />
              {amount && parseInt(amount) < 1000 && (
                <p className="text-xs text-danger mt-1">Mínimo: $1.000</p>
              )}
              {amount && parseInt(amount) >= 1000 && (
                <p className="text-xs text-default-500 mt-1">
                  Abono: {formatCurrency(parseInt(amount))} — Quedaría: {formatCurrency(pendingBalance - parseInt(amount))}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onPress={() => router.back()}>Cancelar</Button>
        <Button
          variant="primary"
          isDisabled={paying || (paymentOption === "partial" && (!amount || parseInt(amount) < 1000))}
          onPress={handlePay}
        >
          <DollarSign className="h-4 w-4" />
          {paying ? "Registrando..." : "Registrar pago"}
        </Button>
      </div>
    </div>
  );
}
