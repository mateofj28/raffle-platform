"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Plus, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { CustomerTable } from "@/features/customers/components/customer-table";
import { useCustomers } from "@/features/customers/hooks/use-customers";

export default function CustomersPage() {
    const { data: customers = [], isLoading } = useCustomers();

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
              <CustomerTable customers={customers} />
          )}
      </div>
  );
}
