"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, Input, Separator } from "@heroui/react";
import { ArrowLeft, User, DollarSign, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Customer, Ticket as TicketType } from "@/types/api.types";

export default function EditTicketPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketNumber = parseInt(params.ticketNumber as string);
  const action = searchParams.get("action") || "client";
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { activeRaffle } = useRaffleStore();

  const [ticket, setTicket] = useState<TicketType | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRaffle) router.push("/raffles");
  }, [activeRaffle, router]);

  // Load ticket + customers
  useEffect(() => {
    if (!tenantId || !activeRaffle) return;
    const load = async () => {
      // Load ticket
      const padded = String(ticketNumber).padStart(5, "0");
      const ticketDoc = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", activeRaffle.id, "tickets", padded));
      if (ticketDoc.exists()) setTicket(ticketDoc.data() as TicketType);

      // Load customers
      const snap = await getDocs(tenantCollection(tenantId, "customers"));
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]);
    };
    load();
  }, [tenantId, activeRaffle, ticketNumber]);

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.document.includes(customerSearch)).slice(0, 6)
    : [];

  // Change client on ticket
  const handleChangeClient = async () => {
    if (!selectedCustomerId || !activeRaffle) return;
    setProcessing(true);
    setError(null);
    try {
      await callFunction("updateTicketClient", {
        raffleId: activeRaffle.id,
        ticketNumber,
        customerId: selectedCustomerId,
      });
      setSuccess(`Cliente actualizado a: ${selectedCustomerName}`);
      setTimeout(() => router.back(), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al actualizar el cliente");
    } finally {
      setProcessing(false);
    }
  };

  if (!activeRaffle) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Editar boleta #${ticketNumber}`}
        description={action === "client" ? "Cambiar o asignar cliente" : "Editar información"}
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

      {/* Ticket info */}
      {ticket && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-mono font-bold">#{ticketNumber}</span>
              <span className="text-default-500">Estado: <span className="font-medium text-foreground">{{ available: "Disponible", assigned: "Asignada", sold: "Vendida", paid: "Pagada", installment: "Abonada", cancelled: "Cancelada", winner: "Ganadora" }[ticket.status] || ticket.status}</span></span>
              <span className="text-default-500">Saldo: <span className="font-medium text-foreground">{formatCurrency(ticket.pendingBalance)}</span></span>
              {ticket.customerId && (
                <span className="text-default-500">Cliente actual: <span className="font-medium text-foreground">{customers.find(c => c.id === ticket.customerId)?.name || "—"} ({customers.find(c => c.id === ticket.customerId)?.document || ticket.customerId})</span></span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change client */}
      {action === "client" && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-amber-400" />
              Cambiar / Asignar cliente
            </h3>

            <div className="space-y-3">
              <Input
                placeholder="Buscar por nombre o cédula..."
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); setSelectedCustomerName(""); }}
                className="w-full"
              />

              {filteredCustomers.length > 0 && !selectedCustomerId && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-default-200 divide-y divide-default-100">
                  {filteredCustomers.map(c => (
                    <button key={c.id} type="button" onClick={() => { setSelectedCustomerId(c.id); setSelectedCustomerName(c.name); setCustomerSearch(c.name); }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-default-100 transition-colors flex justify-between">
                      <span><span className="font-medium">{c.name}</span> <span className="text-default-500 text-xs ml-2">CC {c.document}</span></span>
                      <span className="text-xs text-default-400">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}

              {customerSearch.length >= 2 && filteredCustomers.length === 0 && !selectedCustomerId && (
                <div className="text-center py-3 rounded-lg border border-dashed border-default-300">
                  <p className="text-xs text-default-500">No encontrado. <Link href="/customers/new" className="text-primary underline">Crear cliente</Link></p>
                </div>
              )}

              {selectedCustomerId && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                  <User className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium flex-1">{selectedCustomerName}</span>
                  <Button variant="ghost" size="sm" onPress={() => { setSelectedCustomerId(""); setSelectedCustomerName(""); setCustomerSearch(""); }}>Cambiar</Button>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onPress={() => router.back()}>Cancelar</Button>
              <Button variant="primary" isDisabled={!selectedCustomerId || processing} onPress={handleChangeClient}>
                {processing ? "Guardando..." : "Guardar cliente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
