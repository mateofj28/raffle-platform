"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, Separator, Chip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem, AlertDialog } from "@heroui/react";
import { Ticket, Calendar, Trophy, Hash, DollarSign, ArrowLeft, UserPlus, X, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import { callFunction } from "@/services/firebase-callable";
import type { Raffle, Ticket as TicketType, Vendor } from "@/types/api.types";

const TICKETS_PER_PAGE = 200;

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
    const router = useRouter();
    const raffleId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { setActiveRaffle } = useRaffleStore();

    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [tickets, setTickets] = useState<TicketType[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalTickets, setTotalTickets] = useState(0);

    // Selection mode
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
    const [selectedVendor, setSelectedVendor] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
    const [showNoVendorsModal, setShowNoVendorsModal] = useState(false);

    // Load raffle
    useEffect(() => {
        if (!tenantId || !raffleId) return;
      const load = async () => {
          try {
              const raffleDoc = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", raffleId));
              if (raffleDoc.exists()) {
                  const data = raffleDoc.data();
                  setRaffle({ id: raffleDoc.id, ...data } as Raffle);
                  setTotalTickets(data.totalTickets || 0);
                  setActiveRaffle({
                      id: raffleDoc.id,
                      name: data.name,
                      status: data.status,
                      ticketPrice: data.ticketPrice,
                      totalTickets: data.totalTickets,
                  });
              }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };
      load();
    }, [tenantId, raffleId, setActiveRaffle]);

    // Load tickets
    useEffect(() => {
        if (!tenantId || !raffleId) return;
      const load = async () => {
          setTicketsLoading(true);
          try {
              const col = tenantCollection(tenantId, `raffles/${raffleId}/tickets`);
              const q = query(col, orderBy("number", "asc"), limit(TICKETS_PER_PAGE * page));
              const snap = await getDocs(q);
              const data = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as unknown as TicketType[];
              setTickets(data);
              setHasMore(data.length < totalTickets);
        } catch (e) { console.error(e); }
        finally { setTicketsLoading(false); }
    };
      load();
  }, [tenantId, raffleId, page, totalTickets]);

    // Load vendors
    useEffect(() => {
        if (!tenantId) return;
        const load = async () => {
            try {
                const col = tenantCollection(tenantId, "vendors");
                const q = query(col, orderBy("name", "asc"));
                const snap = await getDocs(q);
                setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vendor[]);
            } catch (e) { console.error(e); }
        };
        load();
    }, [tenantId]);

    // Toggle ticket selection
    const toggleTicket = (num: number, status: string) => {
        if (!selectionMode) return;
        if (status !== "available") return; // Only available tickets can be selected
        setSelectedTickets((prev) =>
            prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
        );
    };

    // Assign selected tickets
    const handleAssign = async () => {
        if (!selectedVendor || selectedTickets.length === 0) return;
        setAssigning(true);
        setAssignError(null);
        setAssignSuccess(null);

        try {
            const result = await callFunction<{ assigned: number; skipped: number }>("assignTickets", {
                raffleId,
                vendorId: selectedVendor,
                ticketNumbers: selectedTickets,
            });
            setAssignSuccess(`✅ ${result.assigned} boletas asignadas correctamente.`);
            setSelectedTickets([]);
            setSelectionMode(false);
            setSelectedVendor("");
            // Reload tickets
            setPage(1);
            setTicketsLoading(true);
            const col = tenantCollection(tenantId!, `raffles/${raffleId}/tickets`);
            const q = query(col, orderBy("number", "asc"), limit(TICKETS_PER_PAGE));
            const snap = await getDocs(q);
            setTickets(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as unknown as TicketType[]);
            setTicketsLoading(false);
        } catch (err) {
            setAssignError(err instanceof Error ? err.message : "Error al asignar boletas");
        } finally {
            setAssigning(false);
    }
    };

    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedTickets([]);
        setSelectedVendor("");
        setAssignError(null);
    };

    if (loading) return <div><PageHeader title="Detalle de Rifa" /><LoadingSkeleton rows={6} /></div>;
    if (!raffle) return <div><PageHeader title="Rifa no encontrada" /><p className="text-default-500">No se encontró la rifa.</p></div>;

    const statusCounts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    const vendorName = vendors.find((v) => v.id === selectedVendor)?.name || "";

    return (
        <div>
            <PageHeader
                title={raffle.name}
                description={raffle.description}
                actions={
                    <div className="flex gap-2">
                <Link href="/raffles"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button></Link>
                {!selectionMode && (
                            <Button variant="primary" size="sm" onPress={() => {
                                if (vendors.length === 0) {
                                    setShowNoVendorsModal(true);
                                    return;
                                }
                                setSelectionMode(true);
                            }}>
                        <UserPlus className="h-4 w-4" /> Asignar Boletas
                    </Button>
                      )}
                  </div>
              }
          />

          {/* Raffle Info */}
          <Card className="mb-6">
              <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10"><Trophy className="h-5 w-5 text-primary" /></div>
                          <div><p className="text-xs text-default-500">Premio</p><p className="font-semibold text-sm">{raffle.prize}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10"><DollarSign className="h-5 w-5 text-success" /></div>
                          <div><p className="text-xs text-default-500">Precio boleta</p><p className="font-semibold text-sm">{formatCurrency(raffle.ticketPrice)}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-warning/10"><Hash className="h-5 w-5 text-warning" /></div>
                          <div><p className="text-xs text-default-500">Total boletas</p><p className="font-semibold text-sm">{raffle.totalTickets.toLocaleString()}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-default-100"><Calendar className="h-5 w-5 text-default-600" /></div>
                          <div><p className="text-xs text-default-500">Sorteo</p><p className="font-semibold text-sm">{formatDate(raffle.drawDate)}</p></div>
                      </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2"><span className="text-sm text-default-500">Estado:</span><StatusBadge status={raffle.status} /></div>
                      <div className="flex items-center gap-2"><span className="text-sm text-default-500">Lotería:</span><span className="text-sm font-medium">{raffle.lottery}</span></div>
                  </div>
              </CardContent>
          </Card>

          {/* Assignment Panel */}
          {selectionMode && (
              <Card className="mb-4 border-2 border-amber-500/50">
                  <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="flex-1">
                              <p className="font-semibold text-amber-300 mb-1">
                                  Modo asignación — Toca las boletas disponibles para seleccionarlas
                              </p>
                              <p className="text-xs text-default-500">
                                  {selectedTickets.length === 0
                                      ? "Ninguna boleta seleccionada"
                                      : `${selectedTickets.length} boleta${selectedTickets.length > 1 ? "s" : ""} seleccionada${selectedTickets.length > 1 ? "s" : ""}: ${selectedTickets.sort((a, b) => a - b).join(", ")}`}
                              </p>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Select
                                    aria-label="Vendedor"
                                    selectedKey={selectedVendor || null}
                                    onSelectionChange={(key) => setSelectedVendor(String(key ?? ""))}
                                    placeholder="Seleccionar vendedor"
                                    className="flex-1 sm:w-52"
                              >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                        <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                    </SelectTrigger>
                                    <SelectPopover>
                                        <ListBox>
                                            {vendors.map((v) => (
                                                <ListBoxItem key={v.id} id={v.id} textValue={v.name}>
                                                    {v.name}
                                                </ListBoxItem>
                                            ))}
                                        </ListBox>
                                    </SelectPopover>
                                </Select>
                              <Button
                                  variant="primary"
                                  size="sm"
                                  isDisabled={!selectedVendor || selectedTickets.length === 0 || assigning}
                                  onPress={handleAssign}
                              >
                                  <Check className="h-4 w-4" />
                                  {assigning ? "Asignando..." : "Asignar"}
                              </Button>
                              <Button variant="ghost" size="sm" onPress={cancelSelection}>
                                  <X className="h-4 w-4" /> Cancelar
                              </Button>
                          </div>
                      </div>
                      <FormErrorBanner message={assignError} />
                  </CardContent>
              </Card>
          )}

          {assignSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm">
                  {assignSuccess}
              </div>
          )}

          {/* Status chips + Legend */}
          <div className="flex gap-2 flex-wrap mb-3">
              {Object.entries(statusCounts).map(([status, count]) => (
            <Chip key={status} size="sm" variant="soft">{status}: {count}</Chip>
        ))}
          </div>
          <div className="flex gap-3 flex-wrap mb-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-700 border border-zinc-600" /> Disponible</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-900/60 border border-amber-700" /> Asignada</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900/60 border border-blue-700" /> Vendida</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-900/60 border border-emerald-700" /> Pagada</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-900/60 border border-purple-700" /> Abonada</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/60 border border-red-700" /> Cancelada</span>
          </div>

          {/* Tickets Grid */}
          {ticketsLoading ? <LoadingSkeleton rows={5} /> : (
              <>
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1.5">
                        {tickets.map((ticket) => (
                            <TicketCell
                                key={ticket.number}
                                ticket={ticket}
                                selectionMode={selectionMode}
                                isSelected={selectedTickets.includes(ticket.number)}
                                onToggle={toggleTicket}
                                vendors={vendors}
                            />
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

            {/* AlertDialog: No vendors */}
            <AlertDialog.Backdrop isOpen={showNoVendorsModal} onOpenChange={setShowNoVendorsModal} isDismissable>
                <AlertDialog.Container placement="center" size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>No hay vendedores registrados</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>Para asignar boletas necesitas tener al menos un vendedor creado en el sistema.</p>
                            <p className="text-sm text-default-500 mt-2">¿Deseas ir a crear un vendedor ahora?</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">
                                Cancelar
                            </Button>
                            <Button variant="primary" onPress={() => {
                                setShowNoVendorsModal(false);
                                router.push("/vendors/new");
                            }}>
                                Crear Vendedor
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </div>
    );
}

// --- Ticket Cell Component ---

function TicketCell({ ticket, selectionMode, isSelected, onToggle, vendors }: {
    ticket: TicketType;
    selectionMode: boolean;
    isSelected: boolean;
    onToggle: (num: number, status: string) => void;
    vendors: Vendor[];
}) {
    const [showDetail, setShowDetail] = useState(false);
    const isAvailable = ticket.status === "available";
    const colorClass = isSelected
        ? "bg-amber-500 text-black border-amber-400 ring-2 ring-amber-300"
        : TICKET_COLOR_MAP[ticket.status] || TICKET_COLOR_MAP.available;
    const canSelect = selectionMode && isAvailable;

    const handleClick = () => {
        if (selectionMode) {
            onToggle(ticket.number, ticket.status);
        } else {
            setShowDetail(!showDetail);
        }
    };

    const vendorName = ticket.vendorId ? vendors.find((v) => v.id === ticket.vendorId)?.name || ticket.vendorId : null;

    return (
      <div className="relative">
          <button
              type="button"
              onClick={handleClick}
              className={`w-full aspect-square flex items-center justify-center rounded-md border text-xs font-mono transition-all
          ${colorClass}
          ${canSelect ? "cursor-pointer hover:scale-110 hover:ring-1 hover:ring-amber-400" : ""}
          ${selectionMode && !isAvailable ? "opacity-40 cursor-not-allowed" : ""}
          ${!selectionMode ? "cursor-pointer hover:scale-105" : ""}`}
              title={`#${ticket.number} - ${ticket.status}`}
              disabled={selectionMode && !isAvailable}
          >
              {ticket.number}
          </button>

          {/* Detail popup - only when NOT in selection mode */}
          {showDetail && !selectionMode && (
              <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Boleta #{ticket.number}</span>
                      <button onClick={() => setShowDetail(false)} className="text-zinc-400 hover:text-white">✕</button>
                  </div>
                  <Separator />
                  <div><span className="text-zinc-400">Estado:</span> <StatusBadge status={ticket.status} /></div>
                  <div><span className="text-zinc-400">Valor:</span> <span className="text-white">{formatCurrency(ticket.value)}</span></div>
                  <div><span className="text-zinc-400">Saldo:</span> <span className="text-white">{formatCurrency(ticket.pendingBalance)}</span></div>
                  {vendorName && (
                      <div><span className="text-zinc-400">Vendedor:</span> <span className="font-medium text-amber-300">{vendorName}</span></div>
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
