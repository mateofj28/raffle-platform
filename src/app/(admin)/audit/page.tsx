"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Chip, Input } from "@heroui/react";
import { Shield, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, orderBy, limit } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";

interface AuditEntry {
    id: string;
    operationType: string;
    entityType: string;
    entityId: string;
    userId: string;
    metadata: Record<string, unknown>;
    timestamp: string;
}

const OPERATION_LABELS: Record<string, { label: string; color: "success" | "warning" | "danger" | "accent" | "default" }> = {
    payment_registered: { label: "Pago registrado", color: "success" },
    payment_deleted: { label: "Pago eliminado", color: "danger" },
    payment_corrected: { label: "Pago corregido", color: "warning" },
    ticket_sold: { label: "Boleta vendida", color: "accent" },
    ticket_cancelled: { label: "Boleta cancelada", color: "danger" },
    tickets_assigned: { label: "Boletas asignadas", color: "default" },
    tickets_unassigned: { label: "Boletas desasignadas", color: "warning" },
    raffle_created: { label: "Rifa creada", color: "success" },
    raffle_status_changed: { label: "Estado de rifa cambiado", color: "warning" },
    winning_number_set: { label: "Número ganador registrado", color: "success" },
    vendor_created: { label: "Vendedor creado", color: "default" },
    customer_created: { label: "Cliente creado", color: "default" },
};

function getOperationDescription(entry: AuditEntry): string {
    const meta = entry.metadata || {};
    switch (entry.operationType) {
        case "payment_registered":
            return `Registró ${meta.type === "payment" ? "pago completo" : "abono"} de $${(meta.amount as number)?.toLocaleString("es-CO")} en boleta ${meta.ticketNumber} (${meta.method})`;
        case "payment_deleted":
            return `Eliminó pago de $${(meta.amount as number)?.toLocaleString("es-CO")} en boleta ${meta.ticketId}. Razón: ${meta.reason}`;
        case "payment_corrected":
            return `Corrigió pago de $${(meta.oldAmount as number)?.toLocaleString("es-CO")} → $${(meta.newAmount as number)?.toLocaleString("es-CO")}. Razón: ${meta.reason}`;
        case "ticket_sold":
            return `Vendió boleta #${meta.ticketNumber} al cliente ${meta.customerId}`;
        case "ticket_cancelled":
            return `Canceló boleta #${meta.ticketNumber}`;
        case "tickets_assigned":
            return `Asignó ${meta.assigned} boletas al vendedor ${meta.vendorId}`;
        case "tickets_unassigned":
            return `Desasignó ${meta.unassigned} boletas`;
        case "raffle_created":
            return `Creó rifa "${meta.name}" con ${(meta.totalTickets as number)?.toLocaleString()} boletas a $${(meta.ticketPrice as number)?.toLocaleString("es-CO")}`;
        case "raffle_status_changed":
            return `Cambió estado de rifa: ${meta.from} → ${meta.to}`;
        case "winning_number_set":
            return `Registró número ganador: ${meta.winningNumber} (boleta ${meta.winnerTicket})`;
        case "vendor_created":
            return `Creó vendedor "${meta.name}"`;
        case "customer_created":
            return `Creó cliente "${meta.name}"`;
        default:
            return `${entry.operationType} en ${entry.entityType} (${entry.entityId})`;
    }
}

export default function AuditPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!tenantId) return;
        const load = async () => {
            try {
                const col = tenantCollection(tenantId, "auditTrail");
                const q = query(col, orderBy("timestamp", "desc"), limit(200));
                const snap = await getDocs(q);
                setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })) as AuditEntry[]);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId]);

    const filtered = searchTerm.length >= 2
        ? entries.filter(e => {
            const desc = getOperationDescription(e).toLowerCase();
            const op = OPERATION_LABELS[e.operationType]?.label.toLowerCase() || "";
            return desc.includes(searchTerm.toLowerCase()) || op.includes(searchTerm.toLowerCase());
        })
        : entries;

    if (loading) return <div><PageHeader title="Auditoría" /><LoadingSkeleton rows={8} /></div>;

    return (
        <div>
            <PageHeader title="Auditoría" description="Registro de todas las operaciones realizadas en la plataforma" />

            {/* Search */}
            <div className="mb-4">
                <Input
                    placeholder="Buscar en el historial..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                />
            </div>

            <Chip size="sm" variant="soft" className="mb-4">{filtered.length} registros</Chip>

            {filtered.length === 0 ? (
                <EmptyState
                    title="Sin registros"
                    description="Aún no hay actividad registrada en la auditoría"
                    icon={<Shield className="h-12 w-12" />}
                />
            ) : (
                <div className="space-y-2">
                    {filtered.map((entry) => {
                        const config = OPERATION_LABELS[entry.operationType] || { label: entry.operationType, color: "default" as const };
                        return (
                            <Card key={entry.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Chip size="sm" variant="soft" color={config.color}>{config.label}</Chip>
                                                <span className="text-xs text-default-400">{entry.entityType}/{entry.entityId?.slice(0, 8)}</span>
                                            </div>
                                            <p className="text-sm text-default-700">{getOperationDescription(entry)}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-default-500">{entry.timestamp ? formatDateTime(entry.timestamp) : "—"}</p>
                                            <p className="text-xs text-default-400 mt-0.5">ID: {entry.userId?.slice(0, 8)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
