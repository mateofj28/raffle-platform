"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Plus, Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RaffleTable } from "@/features/raffles/components/raffle-table";
import { useRaffles } from "@/features/raffles/hooks/use-raffles";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function RafflesPage() {
    const { data, isLoading, isError } = useRaffles();
    const raffles = data?.raffles ?? [];

    return (
        <div>
            <PageHeader
                title="Rifas"
                description="Administra todas tus rifas"
                actions={
                    <Link href="/raffles/new">
                        <Button variant="primary" size="sm">
                            <Plus className="h-4 w-4" /> Nueva Rifa
                        </Button>
                    </Link>
                }
            />

          {isLoading ? (
              <LoadingSkeleton rows={5} />
          ) : isError ? (
              <EmptyState
                  title="Error al cargar rifas"
                  description="No se pudieron obtener las rifas. Verifica la conexión."
                  icon={<Ticket className="h-12 w-12" />}
              />
          ) : raffles.length === 0 ? (
              <EmptyState
                  title="No hay rifas"
                  description="Crea tu primera rifa para comenzar"
                  icon={<Ticket className="h-12 w-12" />}
                  action={
                      <Link href="/raffles/new">
                          <Button variant="primary">Crear Rifa</Button>
                      </Link>
                  }
              />
          ) : (
              <RaffleTable raffles={raffles} />
          )}
      </div>
  );
}
