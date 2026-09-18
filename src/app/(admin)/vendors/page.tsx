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
import { getDocs, query, where } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";

export default function VendorsPage() {
    const { data: vendors = [], isLoading, refetch } = useVendors();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
    const [search, setSearch] = useState("");
    const [isDark, setIsDark] = useState(false);
    // Vendedores con alguna boleta "pendiente" (no cerrada). No se pueden eliminar.
    const [pendingVendorIds, setPendingVendorIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // Solo admin: calcular qué vendedores tienen boletas "pendientes" en cualquier
    // rifa. Una boleta está cerrada solo si tiene cliente Y pago completo; si no,
    // es pendiente y el vendedor no se puede eliminar (no se muestra el botón).
    useEffect(() => {
        if (!isAdmin || !tenantId) return;
        let cancelled = false;
        (async () => {
            try {
                const rafflesSnap = await getDocs(tenantCollection(tenantId, "raffles"));
                const pending = new Set<string>();
                for (const raffle of rafflesSnap.docs) {
                    const ticketsSnap = await getDocs(query(
                        tenantCollection(tenantId, `raffles/${raffle.id}/tickets`),
                        where("vendorId", "!=", null)
                    ));
                    ticketsSnap.docs.forEach((d) => {
                        const t = d.data();
                        const value = (t.value as number) ?? 0;
                        const bal = (t.pendingBalance as number) ?? value;
                        const cerrada = !!t.customerId && bal <= 0;
                        if (t.vendorId && !cerrada) pending.add(t.vendorId as string);
                    });
                }
                if (!cancelled) setPendingVendorIds(pending);
            } catch (e) { console.error(e); }
        })();
        return () => { cancelled = true; };
    }, [isAdmin, tenantId, vendors]);

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
                                    <VendorTable vendors={filtered} canDelete={isAdmin} pendingIds={pendingVendorIds} onDeleted={() => refetch()} />
                            )}
                        </>
          )}
      </div>
  );
}
