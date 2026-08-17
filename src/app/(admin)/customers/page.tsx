"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@heroui/react";
import { Plus, UserCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { CustomerTable } from "@/features/customers/components/customer-table";
import { useCustomers } from "@/features/customers/hooks/use-customers";

export default function CustomersPage() {
    const { data: customers = [], isLoading } = useCustomers();
    const [search, setSearch] = useState("");

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
                                    className="max-w-sm"
                                />
                            </div>
                            {filtered.length === 0 ? (
                                <p className="text-sm text-default-500 py-8 text-center">No se encontraron clientes con "{search}"</p>
                            ) : (
                                <CustomerTable customers={filtered} />
                            )}
                        </>
          )}
      </div>
  );
}
