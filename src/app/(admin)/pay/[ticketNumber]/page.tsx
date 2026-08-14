"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, Input } from "@heroui/react";
import { ArrowLeft, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency } from "@/utils/formatters";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";

const METHODS = [
  { id: "cash", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
  { id: "nequi", label: "Nequi" },
  { id: "daviplata", label: "Daviplata" },
  { id: "card", label: "Tarjeta" },
  { id: "other", label: "Otro" },
];

export default function PayTicketPage() {
  const params = useParams();
  const router = useRouter();
  const ticketNumber = parseInt(params.ticketNumber as string);
  const { activeRaffle } = useRaffleStore();

  const [paymentType, setPaymentType] = useState<"full" | "partial">("partial");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [observations, setObservations] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!activeRaffle) return;
    setProcessing(true);
    setError(null);

    const payAmount = paymentType === "full" ? activeRaffle.ticketPrice : parseInt(amount || "0");

    if (payAmount < 1000) {
      setError("El monto mínimo es $1.000");
      setProcessing(false);
      return;
    }

    try {
      await callFunction("registerPayment", {
        raffleId: activeRaffle.id,
        ticketNumber,
        amount: payAmount,
        type: paymentType === "full" ? "payment" : "installment",
        method,
        observations,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar el pago");
    } finally {
      setProcessing(false);
    }
  };

  if (!activeRaffle) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Abonar boleta #${ticketNumber}`}
        description={`Rifa: ${activeRaffle.name}`}
        actions={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        }
      />

      <div className="space-y-6">
        <FormErrorBanner message={error} />

        {/* Payment type */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Tipo de pago
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType("full")}
                className={`text-left p-4 rounded-lg border text-sm transition-all ${paymentType === "full" ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-default-200 hover:bg-default-50"}`}
              >
                <span className="font-semibold">Pago completo</span>
                <span className="text-xs text-default-500 block mt-1">{formatCurrency(activeRaffle.ticketPrice)}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("partial")}
                className={`text-left p-4 rounded-lg border text-sm transition-all ${paymentType === "partial" ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-default-200 hover:bg-default-50"}`}
              >
                <span className="font-semibold">Abono parcial</span>
                <span className="text-xs text-default-500 block mt-1">Paga una parte</span>
              </button>
            </div>

            {paymentType === "partial" && (
              <div className="mt-4">
                <label className="text-sm font-medium mb-2 block">Monto del abono</label>
                <Input
                  type="text"
                  placeholder="Ej: 30.000"
                  value={amount ? parseInt(amount).toLocaleString("es-CO") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const num = parseInt(raw || "0");
                    if (num >= activeRaffle.ticketPrice) {
                      setAmount(String(activeRaffle.ticketPrice));
                      setPaymentType("full");
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
                  <p className="text-xs text-default-500 mt-1">Abono: {formatCurrency(parseInt(amount))}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment method */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">Método de pago</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`p-3 rounded-lg border text-sm text-center transition-all ${method === m.id ? "border-primary bg-primary/5 ring-1 ring-primary/30 font-medium" : "border-default-200 hover:bg-default-50"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Observations */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">Observaciones (opcional)</h3>
            <Input
              type="text"
              placeholder="Ej: Pagó en dos partes"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Confirm */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Button variant="ghost" onPress={() => router.back()}>Cancelar</Button>
          <Button
            variant="primary"
            isDisabled={processing || (paymentType === "partial" && (!amount || parseInt(amount) < 1000))}
            onPress={handlePay}
          >
            <DollarSign className="h-4 w-4" />
            {processing ? "Registrando..." : paymentType === "full" ? `Pagar ${formatCurrency(activeRaffle.ticketPrice)}` : `Abonar ${amount ? formatCurrency(parseInt(amount)) : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
