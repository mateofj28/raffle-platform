"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { VendorTable } from "@/features/vendors/components/vendor-table";
import { useVendors } from "@/features/vendors/hooks/use-vendors";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, where } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";

export default function VendorsPage() {
    const { data: vendors = [], isLoading, refetch } = useVendors();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
    const activeRaffle = useRaffleStore((s) => s.activeRaffle);
    const [search, setSearch] = useState("");
    const [isDark, setIsDark] = useState(false);
    // Vendedores con alguna boleta "pendiente" (no cerrada). No se pueden eliminar.
    const [pendingVendorIds, setPendingVendorIds] = useState<Set<string>>(new Set());
    // ¿Ya terminó el cálculo de elegibilidad? Evita el parpadeo de papeleras.
    const [pendingReady, setPendingReady] = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // Solo admin: qué vendedores tienen boletas "pendientes" EN LA RIFA ACTUAL.
    // La responsabilidad del vendedor es solo en la rifa actual; sus boletas en
    // rifas anteriores no cuentan. Cerrada = con cliente Y pago completo; si no,
    // es pendiente y el vendedor no se puede eliminar (no se muestra el botón).
    useEffect(() => {
        if (!isAdmin || !tenantId) return;
        if (!activeRaffle) { setPendingVendorIds(new Set()); setPendingReady(true); return; }
        let cancelled = false;
        (async () => {
            try {
                const pending = new Set<string>();
                const ticketsSnap = await getDocs(query(
                    tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`),
                    where("vendorId", "!=", null)
                ));
                ticketsSnap.docs.forEach((d) => {
                    const t = d.data();
                    const value = (t.value as number) ?? 0;
                    const bal = (t.pendingBalance as number) ?? value;
                    const cerrada = !!t.customerId && bal <= 0;
                    if (t.vendorId && !cerrada) pending.add(t.vendorId as string);
                });
                if (!cancelled) { setPendingVendorIds(pending); setPendingReady(true); }
            } catch (e) { console.error(e); if (!cancelled) setPendingReady(true); }
        })();
        return () => { cancelled = true; };
    }, [isAdmin, tenantId, activeRaffle, vendors]);

    const filtered = search.length >= 2
        ? vendors.filter(v =>
            v.name.toLowerCase().includes(search.toLowerCase()) ||
            v.document.includes(search)
        )
        : vendors;

    return (
        <div>
            <PageHeader
                title="Vendedores"
                description="Gestiona tus vendedores y sus comisiones"
                actions={
                    <Link href="/vendors/new">
                      <Button variant="primary" size="sm">
                          <Plus className="h-4 w-4" /> Nuevo Vendedor
                      </Button>
                  </Link>
              }
          />

          {isLoading ? (
              <LoadingSkeleton rows={5} />
          ) : vendors.length === 0 ? (
              <EmptyState
                  title="No hay vendedores"
                  description="Agrega tu primer vendedor"
                  icon={<Users className="h-12 w-12" />}
                  action={
                      <Link href="/vendors/new">
                          <Button variant="primary">Nuevo Vendedor</Button>
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
                                <p className="text-sm text-default-500 py-8 text-center">No se encontraron vendedores con "{search}"</p>
                            ) : (
                                    <VendorTable vendors={filtered} canDelete={isAdmin && pendingReady} pendingIds={pendingVendorIds} onDeleted={() => refetch()} />
                            )}
                        </>
          )}
      </div>
  );
}
