"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, Separator, Chip } from "@heroui/react";
import { Ticket, Calendar, Trophy, Hash, DollarSign, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, orderBy, limit, startAfter, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Raffle, Ticket as TicketType } from "@/types/api.types";

const TICKETS_PER_PAGE = 100;

const TICKET_COLOR_MAP: Record<string, string> = {
    available: "bg-zinc-700 text-zinc-200 border-zinc-600",
    assigned: "bg-amber-900/60 text-amber-300 border-amber-700",
    sold: "bg-blue-900/60 text-blue-300 border-blue-700",
    paid: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    installment: "bg-purple-900/60 text-purple-300 border-purple-700",
    cancelled: "bg-red-900/60 text-red-300 border-red-700",
    winner: "bg-emerald-800 text-emerald-200 border-emerald-500 ring-2 ring-emerald-400",
};

export default function RaffleDetailPage() {
    const params = useParams();
    const raffleId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [tickets, setTickets] = useState<TicketType[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalTickets, setTotalTickets] = useState(0);

    // Load raffle info
    useEffect(() => {
        if (!tenantId || !raffleId) return;
        const loadRaffle = async () => {
            try {
                const raffleDoc = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", raffleId));
                if (raffleDoc.exists()) {
                    setRaffle({ id: raffleDoc.id, ...raffleDoc.data() } as Raffle);
                    setTotalTickets(raffleDoc.data().totalTickets || 0);
                }
            } catch (e) {
                console.error("Error loading raffle:", e);
            } finally {
                setLoading(false);
            }
        };
        loadRaffle();
    }, [tenantId, raffleId]);

    // Load tickets
    useEffect(() => {
        if (!tenantId || !raffleId) return;
        const loadTickets = async () => {
            setTicketsLoading(true);
            try {
                const col = tenantCollection(tenantId, `raffles/${raffleId}/tickets`);
                const q = query(col, orderBy("number", "asc"), limit(TICKETS_PER_PAGE * page));
                const snap = await getDocs(q);
                const data = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as unknown as TicketType[];
                setTickets(data);
                setHasMore(data.length < totalTickets);
            } catch (e) {
                console.error("Error loading tickets:", e);
            } finally {
                setTicketsLoading(false);
            }
        };
        loadTickets();
    }, [tenantId, raffleId, page, totalTickets]);

    if (loading) {
        return (
            <div>
                <PageHeader title="Detalle de Rifa" />
                <LoadingSkeleton rows={6} />
            </div>
        );
    }

    if (!raffle) {
        return (
            <div>
                <PageHeader title="Rifa no encontrada" />
                <p className="text-default-500">No se encontró la rifa solicitada.</p>
            </div>
        );
    }

    // Count by status
    const statusCounts = tickets.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div>
            <PageHeader
                title={raffle.name}
                description={raffle.description}
                actions={
                    <div className="flex gap-2">
                        <Link href="/raffles">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4" /> Volver
                            </Button>
                        </Link>
                        <Link href={`/raffles/${raffleId}/edit`}>
                            <Button variant="outline" size="sm">Editar</Button>
                        </Link>
                    </div>
                }
            />

            {/* Raffle Info Card */}
            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Trophy className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Premio</p>
                                <p className="font-semibold text-sm">{raffle.prize}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-success/10">
                                <DollarSign className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Precio boleta</p>
                                <p className="font-semibold text-sm">{formatCurrency(raffle.ticketPrice)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-warning/10">
                                <Hash className="h-5 w-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Total boletas</p>
                                <p className="font-semibold text-sm">{raffle.totalTickets.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-default-100">
                                <Calendar className="h-5 w-5 text-default-600" />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Sorteo</p>
                                <p className="font-semibold text-sm">{formatDate(raffle.drawDate)}</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-default-500">Estado:</span>
                            <StatusBadge status={raffle.status} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-default-500">Lotería:</span>
                            <span className="text-sm font-medium">{raffle.lottery}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-default-500">Inicio:</span>
                            <span className="text-sm">{formatDate(raffle.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-default-500">Fin:</span>
                            <span className="text-sm">{formatDate(raffle.endDate)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Status summary */}
            <div className="flex gap-2 flex-wrap mb-4">
                {Object.entries(statusCounts).map(([status, count]) => (
                    <Chip key={status} size="sm" variant="soft">
                        {status}: {count}
                    </Chip>
                ))}
                <Chip size="sm" variant="soft">
                    Cargadas: {tickets.length} / {totalTickets}
                </Chip>
            </div>

            {/* Legend */}
            <div className="flex gap-3 flex-wrap mb-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-700 border border-zinc-600" /> Disponible</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-900/60 border border-amber-700" /> Asignada</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900/60 border border-blue-700" /> Vendida</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-900/60 border border-emerald-700" /> Pagada</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-900/60 border border-purple-700" /> Abonada</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/60 border border-red-700" /> Cancelada</span>
            </div>

            {/* Tickets Grid */}
            {ticketsLoading ? (
                <LoadingSkeleton rows={5} />
            ) : (
                <>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 xl:grid-cols-20 gap-1">
                        {tickets.map((ticket) => (
                            <TicketCell key={ticket.number} ticket={ticket} />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="mt-4 text-center">
                            <Button variant="outline" size="sm" onPress={() => setPage((p) => p + 1)}>
                                Cargar más boletas
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function TicketCell({ ticket }: { ticket: TicketType }) {
    const [showDetail, setShowDetail] = useState(false);
    const colorClass = TICKET_COLOR_MAP[ticket.status] || TICKET_COLOR_MAP.available;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowDetail(!showDetail)}
                className={`w-full aspect-square flex items-center justify-center rounded-md border text-xs font-mono cursor-pointer transition-all hover:scale-105 ${colorClass}`}
                title={`#${ticket.number} - ${ticket.status}`}
            >
                {ticket.number}
            </button>

            {showDetail && (
                <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-white">Boleta #{ticket.number}</span>
                        <button onClick={() => setShowDetail(false)} className="text-zinc-400 hover:text-white">✕</button>
                    </div>
                    <Separator />
                    <div><span className="text-zinc-400">Estado:</span> <StatusBadge status={ticket.status} /></div>
                    <div><span className="text-zinc-400">Valor:</span> <span className="text-white">{formatCurrency(ticket.value)}</span></div>
                    <div><span className="text-zinc-400">Saldo:</span> <span className="text-white">{formatCurrency(ticket.pendingBalance)}</span></div>
                    {ticket.vendorId && (
                        <div><span className="text-zinc-400">Vendedor:</span> <span className="font-medium text-amber-300">{ticket.vendorId}</span></div>
                    )}
                    {ticket.customerId && (
                        <div><span className="text-zinc-400">Cliente:</span> <span className="font-medium text-blue-300">{ticket.customerId}</span></div>
                    )}
                    {ticket.saleDate && (
                        <div><span className="text-zinc-400">Fecha venta:</span> <span className="text-white">{formatDate(ticket.saleDate)}</span></div>
                    )}
                </div>
            )}
        </div>
    );
}
