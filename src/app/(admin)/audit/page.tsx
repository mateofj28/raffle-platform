"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Chip } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
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
    userName: string;
    userRole: string;
    metadata: Record<string, unknown>;
    timestamp: string;
}

const OPERATION_LABELS: Record<string, { label: string; color: "success" | "warning" | "danger" | "accent" | "default" }> = {
    payment_registered: { label: "Pago registrado", color: "success" },
    payment_deleted: { label: "Pago eliminado", color: "danger" },
    payment_corrected: { label: "Pago corregido", color: "warning" },
    ticket_sold: { label: "Boleta vendida", color: "accent" },
    tickets_assigned: { label: "Boletas asignadas", color: "default" },
    tickets_unassigned: { label: "Boletas desasignadas", color: "warning" },
    raffle_created: { label: "Rifa creada", color: "success" },
    raffle_status_changed: { label: "Estado de rifa cambiado", color: "warning" },
    winning_number_set: { label: "Número ganador registrado", color: "success" },
    vendor_created: { label: "Vendedor creado", color: "default" },
    customer_created: { label: "Cliente creado", color: "default" },
};

const METHOD_LABELS: Record<string, string> = {
    cash: "Efectivo", nequi: "Nequi", daviplata: "Daviplata",
    transfer: "Bancolombia", other: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
    draft: "Borrador", active: "Activa", finished: "Finalizada", cancelled: "Cancelada",
};

function getOperationDescription(entry: AuditEntry, usersMap: Map<string, { name: string; role: string }>): string {
    const meta = entry.metadata || {};
    const method = METHOD_LABELS[meta.method as string] || (meta.method as string) || "";

    switch (entry.operationType) {
        case "payment_registered":
            return `Registró ${meta.type === "payment" ? "pago completo" : "abono"} de $${(meta.amount as number)?.toLocaleString("es-CO")} en boleta #${meta.ticketNumber} — ${method}`;
        case "payment_deleted":
            return `Eliminó pago de $${(meta.amount as number)?.toLocaleString("es-CO")} en boleta ${meta.ticketId}. Razón: ${meta.reason}`;
        case "payment_corrected":
            return `Corrigió pago: $${(meta.oldAmount as number)?.toLocaleString("es-CO")} → $${(meta.newAmount as number)?.toLocaleString("es-CO")}. Razón: ${meta.reason}`;
        case "ticket_sold": {
            const customerName = usersMap.get(meta.customerId as string)?.name || "cliente";
            return `Vendió boleta #${meta.ticketNumber} a ${customerName}`;
        }
        case "tickets_assigned": {
            const vendorName = usersMap.get(meta.vendorId as string)?.name || "vendedor";
            return `Asignó ${meta.assigned} boletas a ${vendorName}`;
        }
        case "tickets_unassigned":
            return `Desasignó ${meta.unassigned} boletas`;
        case "raffle_created":
            return `Creó rifa "${meta.name}" con ${(meta.totalTickets as number)?.toLocaleString()} boletas a $${(meta.ticketPrice as number)?.toLocaleString("es-CO")}`;
        case "raffle_status_changed": {
            const from = STATUS_LABELS[meta.from as string] || meta.from;
            const to = STATUS_LABELS[meta.to as string] || meta.to;
            return `Cambió estado de rifa: ${from} → ${to}`;
        }
        case "winning_number_set":
            return `Registró número ganador: ${meta.winningNumber}`;
        case "vendor_created":
            return `Creó vendedor "${meta.name}"`;
        case "customer_created":
            return `Creó cliente "${meta.name}"`;
        default:
            return `Operación: ${entry.operationType}`;
    }
}

export default function AuditPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [usersMap, setUsersMap] = useState<Map<string, { name: string; role: string }>>(new Map());

    // Load users to resolve names (from users collection + vendors + customers)
    useEffect(() => {
        if (!tenantId) return;
        const loadUsers = async () => {
            const map = new Map<string, { name: string; role: string }>();
            try {
                // Auth users (admin, vendors with login)
                const usersSnap = await getDocs(tenantCollection(tenantId, "users"));
                usersSnap.docs.forEach(d => {
                    const data = d.data();
                    const roleLabel = data.role === "admin" ? "Admin" : data.role === "vendor" ? "Cajero" : "Usuario";
                    map.set(d.id, { name: data.displayName || data.email || "Usuario", role: roleLabel });
                });
                // Vendors (for vendorId references in metadata)
                const vendorsSnap = await getDocs(tenantCollection(tenantId, "vendors"));
                vendorsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (!map.has(d.id)) map.set(d.id, { name: data.name, role: "Vendedor" });
                    if (data.userId && !map.has(data.userId)) map.set(data.userId, { name: data.name, role: "Vendedor" });
                });
                // Customers (for customerId references in metadata)
                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                customersSnap.docs.forEach(d => {
                    if (!map.has(d.id)) map.set(d.id, { name: d.data().name, role: "Cliente" });
                });
            } catch (e) { console.error(e); }
            setUsersMap(map);
        };
        loadUsers();
    }, [tenantId]);

    // Load audit entries
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
            const desc = getOperationDescription(e, usersMap).toLowerCase();
            const op = OPERATION_LABELS[e.operationType]?.label.toLowerCase() || "";
            const userInfo = usersMap.get(e.userId);
            const userName = userInfo ? `${userInfo.role} ${userInfo.name}`.toLowerCase() : "";
            return desc.includes(searchTerm.toLowerCase()) || op.includes(searchTerm.toLowerCase()) || userName.includes(searchTerm.toLowerCase());
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

            <Chip size="sm" variant="soft" className="px-3 py-1 mb-4">{filtered.length} registros</Chip>

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
                        // Use stored userName/userRole (new entries) or resolve from map (old entries)
                        const storedRole = entry.userRole;
                        const storedName = entry.userName;
                        let userDisplay: string;
                        if (storedRole && storedName) {
                            userDisplay = `${storedRole} — ${storedName}`;
                        } else {
                            const userInfo = usersMap.get(entry.userId);
                            userDisplay = userInfo
                                ? `${userInfo.role || "Usuario"} — ${userInfo.name || "Sin nombre"}`
                                : "Administrador";
                        }
                        return (
                            <Card key={entry.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Chip size="sm" variant="soft" color={config.color} className="px-3 py-1">{config.label}</Chip>
                                                <span className="text-xs font-medium text-default-600">{userDisplay}</span>
                                            </div>
                                            <p className="text-sm text-default-700">{getOperationDescription(entry, usersMap)}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-default-500">{entry.timestamp ? formatDateTime(entry.timestamp) : "—"}</p>
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
