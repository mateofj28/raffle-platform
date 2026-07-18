"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Chip } from "@heroui/react";
import { Plus, Ticket, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/utils/formatters";
import { useRaffles } from "@/features/raffles/hooks/use-raffles";
import { useRaffleStore } from "@/store/raffle.store";

export default function RafflesPage() {
    const router = useRouter();
    const { data, isLoading } = useRaffles();
    const raffles = data?.raffles ?? [];
    const { setActiveRaffle } = useRaffleStore();

    const handleSelectRaffle = (raffle: typeof raffles[0]) => {
        setActiveRaffle({
            id: raffle.id,
            name: raffle.name,
            status: raffle.status,
            ticketPrice: raffle.ticketPrice,
            totalTickets: raffle.totalTickets,
        });
        router.push("/dashboard");
    };

    return (
        <div>
            <PageHeader
              title="Mis Rifas"
              description="Selecciona una rifa para administrarla o crea una nueva"
              actions={
                  <Link href="/raffles/new">
                      <Button variant="primary" size="sm">
                          <Plus className="h-4 w-4" /> Nueva Rifa
                      </Button>
                  </Link>
              }
          />

          {isLoading ? (
              <LoadingSkeleton rows={4} />
          ) : raffles.length === 0 ? (
              <EmptyState
                  title="No hay rifas"
                      description="Crea tu primera rifa para comenzar a vender boletas"
                      icon={<Ticket className="h-12 w-12" />}
                      action={
                          <Link href="/raffles/new">
                              <Button variant="primary">Crear Rifa</Button>
                          </Link>
                      }
                  />
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {raffles.map((raffle) => (
                      <Card
                          key={raffle.id}
                          className="cursor-pointer hover:border-primary/50 transition-colors border border-default-200"
                      >
                          <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-3">
                                  <h3 className="font-semibold text-lg">{raffle.name}</h3>
                                  <StatusBadge status={raffle.status} />
                              </div>
                              <p className="text-sm text-default-500 mb-4 line-clamp-2">{raffle.description}</p>
                              <div className="flex items-center justify-between text-sm text-default-600 mb-4">
                                  <span>Boleta: {formatCurrency(raffle.ticketPrice)}</span>
                                  <span>{raffle.totalTickets.toLocaleString()} boletas</span>
                              </div>
                              <Button
                                  variant="primary"
                                  className="w-full"
                                  size="sm"
                                  onPress={() => handleSelectRaffle(raffle)}
                              >
                                  Administrar <ArrowRight className="h-4 w-4" />
                              </Button>
                          </CardContent>
                      </Card>
                  ))}
              </div>
          )}
      </div>
  );
}
