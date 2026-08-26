"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, CardContent } from "@heroui/react";
import { ArrowLeft, Search, Hash, User, DollarSign, Clock } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { doc, getDoc, getDocs, query, where, collection } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Ticket, Customer, Vendor } from "@/types/api.types";

interface TicketSearchResult {
    ticket: Ticket;
    customer: Customer | null;
    vendor: Vendor | null;
    totalCollected: number;
}

export default function TicketSearchPage() {
    const params = useParams();
    const raffleId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [searchInput, setSearchInput] = useState("");
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState<TicketSearchResult | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        const num = parseInt(searchInput);
        if (!num || num < 1 || !tenantId) return;

        setSearching(true);
        setResult(null);
        setNotFound(false);
        setSearched(true);

        try {
            const db = getDb();
            const ticketDocId = String(num).padStart(5, "0");
            const ticketRef = doc(db, "tenants", tenantId, "raffles", raffleId, "tickets", ticketDocId);
            const ticketSnap = await getDoc(ticketRef);

            if (!ticketSnap.exists()) {
                setNotFound(true);
                return;
            }

            const ticket = ticketSnap.data() as Ticket;

            // Fetch customer if exists
            let customer: Customer | null = null;
            if (ticket.customerId) {
                const customerRef = doc(db, "tenants", tenantId, "customers", ticket.customerId);
                const customerSnap = await getDoc(customerRef);
                if (customerSnap.exists()) {
                    customer = { id: customerSnap.id, ...customerSnap.data() } as Customer;
                }
            }

            // Fetch vendor if exists
            let vendor: Vendor | null = null;
            if (ticket.vendorId) {
                const vendorRef = doc(db, "tenants", tenantId, "vendors", ticket.vendorId);
                const vendorSnap = await getDoc(vendorRef);
                if (vendorSnap.exists()) {
                    vendor = { id: vendorSnap.id, ...vendorSnap.data() } as Vendor;
                }
            }

            // Fetch payments for this ticket to calculate total collected
            let totalCollected = 0;
            const paymentsRef = collection(db, "tenants", tenantId, "payments");
            const paymentsQuery = query(
                paymentsRef,
                where("ticketId", "==", ticketDocId),
                where("raffleId", "==", raffleId)
            );
            const paymentsSnap = await getDocs(paymentsQuery);
            paymentsSnap.forEach((payDoc) => {
                totalCollected += (payDoc.data().amount as number) || 0;
            });

            setResult({ ticket, customer, vendor, totalCollected });
        } catch (e) {
            console.error(e);
            setNotFound(true);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div>
            <PageHeader
                title="Buscar Boleta"
                description="Ingresa el número de boleta para consultar su estado"
                actions={
                    <Link href={`/raffles/${raffleId}`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                    </Link>
                }
            />

            {/* Search Input */}
            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="flex items-end gap-3">
                        <div className="flex-1 max-w-xs">
                            <label className="text-sm font-medium mb-1 block">Número de boleta</label>
                            <Input
                                placeholder="Ej: 55"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSearch();
                                    }
                                }}
                                inputMode="numeric"
                                maxLength={5}
                            />
                        </div>
                        <Button
                            variant="primary"
                            onPress={handleSearch}
                            isDisabled={!searchInput || searching}
                        >
                            <Search className="h-4 w-4" />
                            {searching ? "Buscando..." : "Buscar"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Result: Available */}
            {searched && result && result.ticket.status === "available" && (
                <Card className="border-2 border-emerald-500/30">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                <Hash className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Boleta #{result.ticket.number}</h3>
                                <StatusBadge status={result.ticket.status} />
                            </div>
                        </div>
                        <p className="text-default-500">
                            Esta boleta está <span className="font-semibold text-emerald-600">disponible</span> y puede ser asignada a un vendedor.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Result: Assigned/Sold/Paid/Installment */}
            {searched && result && result.ticket.status !== "available" && (
                <Card>
                    <CardContent className="p-6">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                                <Hash className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Boleta #{result.ticket.number}</h3>
                                <StatusBadge status={result.ticket.status} />
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Vendor */}
                            {result.vendor && (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-default-50 dark:bg-default-100/5 border border-default-200">
                                    <User className="h-5 w-5 text-default-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-default-500 mb-0.5">Vendedor</p>
                                        <p className="font-semibold text-sm">{result.vendor.name}</p>
                                        <p className="text-xs text-default-400">{result.vendor.phone}</p>
                                    </div>
                                </div>
                            )}

                            {/* Customer */}
                            {result.customer ? (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-default-50 dark:bg-default-100/5 border border-default-200">
                                    <User className="h-5 w-5 text-blue-500 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-default-500 mb-0.5">Cliente</p>
                                        <p className="font-semibold text-sm">{result.customer.name}</p>
                                        <p className="text-xs text-default-400">{result.customer.phone}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-default-50 dark:bg-default-100/5 border border-default-200">
                                    <User className="h-5 w-5 text-default-300 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-default-500 mb-0.5">Cliente</p>
                                        <p className="font-semibold text-sm text-default-400">Sin cliente asignado</p>
                                    </div>
                                </div>
                            )}

                            {/* Total Collected */}
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-default-50 dark:bg-default-100/5 border border-default-200">
                                <DollarSign className="h-5 w-5 text-emerald-500 mt-0.5" />
                                <div>
                                    <p className="text-xs text-default-500 mb-0.5">Total recaudado</p>
                                    <p className="font-semibold text-sm text-emerald-600">{formatCurrency(result.totalCollected)}</p>
                                </div>
                            </div>

                            {/* Pending Balance */}
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-default-50 dark:bg-default-100/5 border border-default-200">
                                <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                                <div>
                                    <p className="text-xs text-default-500 mb-0.5">Saldo pendiente</p>
                                    <p className="font-semibold text-sm text-orange-600">{formatCurrency(result.ticket.pendingBalance)}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Not Found */}
            {searched && notFound && (
                <Card className="border-2 border-red-500/20">
                    <CardContent className="p-6 text-center">
                        <p className="text-default-500">
                            No se encontró la boleta <span className="font-semibold">#{searchInput}</span> en esta rifa.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
