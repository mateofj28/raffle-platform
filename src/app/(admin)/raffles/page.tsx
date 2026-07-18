"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@heroui/react";
import { Plus, Ticket, ArrowRight, LogOut } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/utils/formatters";
import { useRaffles } from "@/features/raffles/hooks/use-raffles";
import { useRaffleStore } from "@/store/raffle.store";
import { useAuth } from "@/features/auth/hooks/use-auth";

export default function RafflesPage() {
    const router = useRouter();
    const { data, isLoading } = useRaffles();
    const raffles = data?.raffles ?? [];
    const { setActiveRaffle } = useRaffleStore();
    const { user, logout } = useAuth();

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
          {/* Simple header for this page */}
          <div className="flex items-center justify-between mb-8">
              <div>
                  <h1 className="text-3xl font-bold">Raffle Platform</h1>
                  <p className="text-default-500 mt-1">
                      Hola, {user?.displayName || "Administrador"}. Selecciona una rifa para administrar.
                  </p>
              </div>
              <div className="flex items-center gap-3">
                  <Link href="/raffles/new">
                      <Button variant="primary" size="sm">
                          <Plus className="h-4 w-4" /> Nueva Rifa
                      </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onPress={() => logout()}>
                      <LogOut className="h-4 w-4" />
                  </Button>
              </div>
          </div>

          {isLoading ? (
              <LoadingSkeleton rows={4} />
          ) : raffles.length === 0 ? (
              <EmptyState
                      title="No hay rifas creadas"
                      description="Crea tu primera rifa para comenzar a vender boletas"
                      icon={<Ticket className="h-16 w-16" />}
                      action={
                          <Link href="/raffles/new">
                              <Button variant="primary" size="lg">Crear mi primera rifa</Button>
                          </Link>
                      }
                  />
              ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {raffles.map((raffle) => (
                              <Card
                                  key={raffle.id}
                  className="hover:border-primary/50 transition-all hover:shadow-lg border border-default-200"
              >
                  <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-lg">{raffle.name}</h3>
                          <StatusBadge status={raffle.status} />
                      </div>
                      <p className="text-sm text-default-500 mb-5 line-clamp-2">
                          {raffle.description || "Sin descripción"}
                      </p>
                      <div className="flex items-center justify-between text-sm text-default-600 mb-5">
                          <span>{formatCurrency(raffle.ticketPrice)} / boleta</span>
                          <span>{raffle.totalTickets.toLocaleString()} boletas</span>
                      </div>
                      <Button
                          variant="primary"
                          className="w-full"
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
