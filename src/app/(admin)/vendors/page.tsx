"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { VendorTable } from "@/features/vendors/components/vendor-table";
import { useVendors } from "@/features/vendors/hooks/use-vendors";

export default function VendorsPage() {
    const { data: vendors = [], isLoading } = useVendors();
    const [search, setSearch] = useState("");

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
                                    className="max-w-sm"
                                />
                            </div>
                            {filtered.length === 0 ? (
                                <p className="text-sm text-default-500 py-8 text-center">No se encontraron vendedores con "{search}"</p>
                            ) : (
                                <VendorTable vendors={filtered} />
                            )}
                        </>
          )}
      </div>
  );
}
