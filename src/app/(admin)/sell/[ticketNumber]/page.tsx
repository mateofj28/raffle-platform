"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Input, Separator } from "@heroui/react";
import { ArrowLeft, User, Ticket, DollarSign, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Customer } from "@/types/api.types";

export default function SellTicketPage() {
  const params = useParams();
  const router = useRouter();
  const ticketNumber = parseInt(params.ticketNumber as string);
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { activeRaffle } = useRaffleStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [paymentOption, setPaymentOption] = useState<"none" | "full" | "partial">("none");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRaffle) router.push("/raffles");
  }, [activeRaffle, router]);

  // Load customers
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const snap = await getDocs(tenantCollection(tenantId, "customers"));
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]);
    };
    load();
  }, [tenantId]);

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.document.includes(customerSearch)
      ).slice(0, 6)
    : [];

  const selectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(c.name);
    setCustomerSearch(c.name);
  };

  const handleSell = async () => {
    if (!selectedCustomerId || !activeRaffle) return;
    setSelling(true);
    setError(null);

    try {
      // 1. Sell
      await callFunction("sellTicket", {
        raffleId: activeRaffle.id,
        ticketNumber,
        customerId: selectedCustomerId,
      });

      // 2. Payment if selected
      if (paymentOption === "full") {
        await callFunction("registerPayment", {
          raffleId: activeRaffle.id,
          ticketNumber,
          amount: activeRaffle.ticketPrice,
          type: "payment",
          method: "cash",
          observations: "Pago completo al momento de la venta",
        });
      } else if (paymentOption === "partial" && paymentAmount) {
        const amount = parseInt(paymentAmount);
        if (amount >= 1000) {
          await callFunction("registerPayment", {
            raffleId: activeRaffle.id,
            ticketNumber,
            amount,
            type: "installment",
            method: "cash",
            observations: "Abono al momento de la venta",
          });
        }
      }

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar la venta");
    } finally {
      setSelling(false);
    }
  };

  if (!activeRaffle) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Vender boleta #${ticketNumber}`}
        description={`Rifa: ${activeRaffle.name} — Valor: ${formatCurrency(activeRaffle.ticketPrice)}`}
        actions={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        }
      />

      <div className="space-y-6">
        <FormErrorBanner message={error} />

        {/* Step 1: Customer */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-400" />
              1. Seleccionar cliente
            </h3>

            <div className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="Buscar por nombre o cédula..."
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); setSelectedCustomerName(""); }}
                  className="w-full"
                />
              </div>

              {/* Search results */}
              {filteredCustomers.length > 0 && !selectedCustomerId && (
                <div className="rounded-lg border border-default-200 divide-y divide-default-100 overflow-hidden">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-default-100 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-default-500 ml-3 text-xs">CC {c.document}</span>
                      </div>
                      <span className="text-xs text-default-400">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {customerSearch.length >= 2 && filteredCustomers.length === 0 && !selectedCustomerId && (
                <div className="text-center py-4 rounded-lg border border-dashed border-default-300">
                  <p className="text-sm text-default-500 mb-2">No se encontró ningún cliente</p>
                  <Link href="/customers/new">
                    <Button variant="outline" size="sm">Crear cliente nuevo</Button>
                  </Link>
                </div>
              )}

              {/* Selected */}
              {selectedCustomerId && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                  <div className="p-1.5 rounded-full bg-success/10">
                    <User className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedCustomerName}</p>
                    <p className="text-xs text-default-500">Cliente seleccionado</p>
                  </div>
                  <Button variant="ghost" size="sm" onPress={() => { setSelectedCustomerId(""); setSelectedCustomerName(""); setCustomerSearch(""); }}>
                    Cambiar
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Payment */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              2. ¿Cómo paga?
            </h3>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPaymentOption("none")}
                className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${paymentOption === "none" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-default-200 hover:bg-default-50"}`}
              >
                <span className="font-semibold">Solo asignar al cliente</span>
                <span className="text-xs text-default-500 block mt-1">La boleta queda como "vendida" con saldo pendiente de {formatCurrency(activeRaffle.ticketPrice)}. Pagará después.</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentOption("full")}
                className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${paymentOption === "full" ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-default-200 hover:bg-default-50"}`}
              >
                <span className="font-semibold">Pago completo</span>
                <span className="text-xs text-default-500 block mt-1">El cliente paga {formatCurrency(activeRaffle.ticketPrice)} ahora. Boleta queda como "pagada".</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentOption("partial")}
                className={`w-full text-left p-4 rounded-lg border text-sm transition-all ${paymentOption === "partial" ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-default-200 hover:bg-default-50"}`}
              >
                <span className="font-semibold">Abono parcial</span>
                <span className="text-xs text-default-500 block mt-1">El cliente paga una parte ahora y el resto después.</span>
              </button>

              {paymentOption === "partial" && (
                <div className="mt-3 pl-4 border-l-2 border-amber-500/30">
                  <label className="text-sm font-medium mb-2 block">Monto del abono</label>
                  <Input
                    type="text"
                    placeholder="Ej: 30.000"
                    value={paymentAmount ? parseInt(paymentAmount).toLocaleString("es-CO") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const num = parseInt(raw || "0");
                      // Cap at ticket price
                      if (num > activeRaffle.ticketPrice) {
                        setPaymentAmount(String(activeRaffle.ticketPrice));
                        // If equals full price, switch to full payment
                        setPaymentOption("full");
                      } else {
                        setPaymentAmount(raw);
                      }
                    }}
                    className="w-full"
                    inputMode="numeric"
                  />
                  {paymentAmount && parseInt(paymentAmount) < 1000 && (
                    <p className="text-xs text-danger mt-1">Mínimo: $1.000</p>
                  )}
                  {paymentAmount && parseInt(paymentAmount) >= 1000 && (
                    <p className="text-xs text-default-500 mt-1">
                      Abono: {formatCurrency(parseInt(paymentAmount))} — Restante: {formatCurrency(activeRaffle.ticketPrice - parseInt(paymentAmount))}
                    </p>
                  )}
                  {!paymentAmount && (
                    <p className="text-xs text-default-500 mt-1">Mínimo: $1.000 — Máximo: {formatCurrency(activeRaffle.ticketPrice)}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Confirm */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Button variant="ghost" onPress={() => router.back()}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            isDisabled={!selectedCustomerId || selling}
            onPress={handleSell}
          >
            <Ticket className="h-4 w-4" />
            {selling ? "Procesando..." : "Confirmar venta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
