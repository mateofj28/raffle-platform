"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, AlertDialog, toast } from "@heroui/react";
import { Plus, Ticket, ArrowRight, LogOut, Trophy, Calendar, Trash2, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useRaffles, useDeleteRaffle } from "@/features/raffles/hooks/use-raffles";
import { useRaffleStore } from "@/store/raffle.store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { Raffle } from "@/types/api.types";

export default function RafflesPage() {
    const router = useRouter();
    const { data, isLoading } = useRaffles();
    const raffles = data?.raffles ?? [];
    const { activeRaffle, setActiveRaffle, clearActiveRaffle } = useRaffleStore();
    const { user, logout } = useAuth();
    const deleteRaffle = useDeleteRaffle();

    const [toDelete, setToDelete] = useState<Raffle | null>(null);

    const handleSelectRaffle = (raffle: Raffle) => {
        setActiveRaffle({
            id: raffle.id,
            name: raffle.name,
            status: raffle.status,
            ticketPrice: raffle.ticketPrice,
            totalTickets: raffle.totalTickets,
        });
        router.push("/dashboard");
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteRaffle.mutateAsync(toDelete.id);
            // Si la rifa borrada era la activa, limpiar la selección
            if (activeRaffle?.id === toDelete.id) clearActiveRaffle();
            toast.success(`Rifa "${toDelete.name}" eliminada`);
            setToDelete(null);
        } catch (e) {
            toast.danger(e instanceof Error ? e.message : "No se pudo eliminar la rifa");
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Rifas</h1>
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
                    <Button variant="ghost" size="sm" onPress={() => logout()} aria-label="Cerrar sesión">
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
                            {raffles.map((raffle) => {
                                const isCurrent = activeRaffle?.id === raffle.id;
                                return (
                                    <Card
                                        key={raffle.id}
                                className={`relative transition-all hover:shadow-lg ${isCurrent
                                        ? "border-2 border-primary shadow-md shadow-primary/10"
                                        : "border border-default-200 hover:border-primary/40"
                                    }`}
                            >
                                {/* Etiqueta "Actual" */}
                                {isCurrent && (
                                    <div className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Rifa actual
                                    </div>
                                )}

                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <h3 className="font-bold text-lg leading-tight">{raffle.name}</h3>
                                        <StatusBadge status={raffle.status} />
                                    </div>

                                    <p className="text-sm text-default-500 mb-4 line-clamp-2 min-h-[2.5rem]">
                                        {raffle.description || "Sin descripción"}
                                    </p>

                                    {/* Info clave */}
                                    <div className="space-y-2 mb-5 text-sm">
                                        <div className="flex items-center gap-2 text-default-600">
                                            <Trophy className="h-4 w-4 text-purple-500 shrink-0" />
                                            <span className="truncate">{raffle.prize || "Sin premio definido"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-default-600">
                                            <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                                            <span>Sorteo: {raffle.drawDate ? formatDate(raffle.drawDate) : "—"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-default-600">
                                            <Ticket className="h-4 w-4 text-emerald-500 shrink-0" />
                                            <span className="font-semibold text-foreground">{formatCurrency(raffle.ticketPrice)}</span>
                                            <span className="text-default-400">por boleta</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={isCurrent ? "primary" : "outline"}
                                            className="flex-1"
                                            onPress={() => handleSelectRaffle(raffle)}
                                        >
                                            {isCurrent ? "Seguir administrando" : "Administrar"} <ArrowRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            isIconOnly
                                            aria-label="Eliminar rifa"
                                            onPress={() => setToDelete(raffle)}
                                        >
                                            <Trash2 className="h-4 w-4 text-danger" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Confirmación de eliminación */}
            <AlertDialog.Backdrop isOpen={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }} isDismissable>
                <AlertDialog.Container placement="center" size="md">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>¿Eliminar la rifa &quot;{toDelete?.name}&quot;?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>Esta acción es permanente. Se eliminará <strong>todo lo relacionado con esta rifa</strong>:</p>
                            <ul className="mt-2 ml-4 list-disc text-sm text-default-600 space-y-1">
                                <li>Todas las boletas (asignadas y vendidas)</li>
                                <li>Los pagos, abonos y su historial</li>
                                <li>Las comisiones generadas</li>
                            </ul>
                            <p className="mt-3 text-sm text-default-500">Los clientes, vendedores y cajeros <strong>no se eliminan</strong>: se conservan para otras rifas.</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cancelar</Button>
                            <Button variant="danger" isDisabled={deleteRaffle.isPending} onPress={handleDelete}>
                                {deleteRaffle.isPending ? "Eliminando..." : "Eliminar rifa"}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </div>
    );
}
