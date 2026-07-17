"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { VendorTable } from "@/features/vendors/components/vendor-table";
import { useVendors } from "@/features/vendors/hooks/use-vendors";

export default function VendorsPage() {
    const { data: vendors = [], isLoading } = useVendors();

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
              <VendorTable vendors={vendors} />
          )}
      </div>
  );
}
