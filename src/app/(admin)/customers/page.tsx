"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { Plus, UserCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { CustomerTable } from "@/features/customers/components/customer-table";
import { useCustomers } from "@/features/customers/hooks/use-customers";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, where } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";

export default function CustomersPage() {
    const { data: customers = [], isLoading, refetch } = useCustomers();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
    const activeRaffle = useRaffleStore((s) => s.activeRaffle);
    const [search, setSearch] = useState("");
    const [isDark, setIsDark] = useState(false);
    // Clientes con alguna boleta "pendiente" (saldo > 0). No se pueden eliminar.
    const [pendingCustomerIds, setPendingCustomerIds] = useState<Set<string>>(new Set());
    // ¿Ya terminó el cálculo de elegibilidad? Hasta que no, no mostramos papeleras
    // (evita el parpadeo de mostrar todas y luego ocultar las no elegibles).
    const [pendingReady, setPendingReady] = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // Solo admin: qué clientes tienen boletas con saldo pendiente EN LA RIFA
    // ACTUAL. Las boletas en rifas anteriores no cuentan. Esas no se pueden
    // eliminar → no se muestra el botón.
    useEffect(() => {
        if (!isAdmin || !tenantId) return;
        if (!activeRaffle) { setPendingCustomerIds(new Set()); setPendingReady(true); return; }
        let cancelled = false;
        (async () => {
            try {
                const pending = new Set<string>();
                const ticketsSnap = await getDocs(query(
                    tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`),
                    where("customerId", "!=", null)
                ));
                ticketsSnap.docs.forEach((d) => {
                    const t = d.data();
                    const value = (t.value as number) ?? 0;
                    const bal = (t.pendingBalance as number) ?? value;
                    if (t.customerId && bal > 0) pending.add(t.customerId as string);
                });
                if (!cancelled) { setPendingCustomerIds(pending); setPendingReady(true); }
            } catch (e) { console.error(e); if (!cancelled) setPendingReady(true); }
        })();
        return () => { cancelled = true; };
    }, [isAdmin, tenantId, activeRaffle, customers]);

    const filtered = search.length >= 2
        ? customers.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.document.includes(search)
        )
        : customers;

    return (
        <div>
            <PageHeader
                title="Clientes"
                description="Administra la información de tus clientes"
                actions={
                    <Link href="/customers/new">
                      <Button variant="primary" size="sm">
                          <Plus className="h-4 w-4" /> Nuevo Cliente
                      </Button>
                  </Link>
              }
          />

          {isLoading ? (
              <LoadingSkeleton rows={5} />
          ) : customers.length === 0 ? (
              <EmptyState
                  title="No hay clientes"
                  description="Los clientes se crean al vender boletas o manualmente"
                  icon={<UserCircle className="h-12 w-12" />}
                  action={
                      <Link href="/customers/new">
                          <Button variant="primary">Nuevo Cliente</Button>
                      </Link>
                  }
              />
          ) : (
                        <>
                            <div className="mb-4">
                                <Input
                                    placeholder="Buscar por nombre o documento..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full max-w-xs"
                                    style={isDark ? undefined : { backgroundColor: "#F3F4F6", borderColor: "#F3F4F6" }}
                                />
                            </div>
                            {filtered.length === 0 ? (
                                <p className="text-sm text-default-500 py-8 text-center">No se encontraron clientes con "{search}"</p>
                            ) : (
                                    <CustomerTable customers={filtered} canDelete={isAdmin && pendingReady} pendingIds={pendingCustomerIds} onDeleted={() => refetch()} />
                            )}
                        </>
          )}
      </div>
  );
}
