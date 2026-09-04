"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Separator } from "@heroui/react";
import { User, Mail, Shield, Trophy, DollarSign, Hash, Calendar, Ticket, Palette, LogOut } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Raffle } from "@/types/api.types";

const ROLE_LABELS: Record<string, string> = {
    admin: "Administrador",
    cashier: "Cajero",
    vendor: "Vendedor",
};

export default function SettingsPage() {
    const { logout } = useAuth();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const user = useAuthStore((s) => s.user);
    const { activeRaffle } = useRaffleStore();

    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [loading, setLoading] = useState(true);

    // Cargar la rifa seleccionada completa desde Firestore
    useEffect(() => {
        if (!tenantId || !activeRaffle?.id) { setLoading(false); return; }
        const load = async () => {
            try {
                const snap = await getDoc(doc(getDb(), "tenants", tenantId, "raffles", activeRaffle.id));
                if (snap.exists()) setRaffle({ id: snap.id, ...snap.data() } as Raffle);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, activeRaffle?.id]);

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader title="Configuración" description="Información de la cuenta y la rifa" />

            <div className="space-y-6">
                {/* Rifa seleccionada */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-primary" /> Rifa seleccionada
                        </h3>

                        {loading ? (
                            <LoadingSkeleton rows={3} />
                        ) : !raffle ? (
                            <EmptyState title="Sin rifa seleccionada" description="Selecciona una rifa para ver su información" icon={<Ticket className="h-10 w-10" />} />
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-lg font-bold">{raffle.name}</p>
                                    <StatusBadge status={raffle.status} />
                                </div>
                                {raffle.description && <p className="text-sm text-default-500 mb-4">{raffle.description}</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                    <InfoItem icon={<Trophy className="h-5 w-5 text-purple-500" />} label="Premio" value={raffle.prize || "—"} />
                                    <InfoItem icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Valor del premio" value={raffle.prizeValue ? formatCurrency(raffle.prizeValue) : "—"} />
                                    <InfoItem icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Precio boleta" value={formatCurrency(raffle.ticketPrice)} />
                                    <InfoItem icon={<Hash className="h-5 w-5 text-amber-500" />} label="Total boletas" value={raffle.totalTickets.toLocaleString("es-CO")} />
                                    <InfoItem icon={<Hash className="h-5 w-5 text-amber-500" />} label="Números por boleta" value={String(raffle.numbersPerTicket)} />
                                    <InfoItem icon={<Trophy className="h-5 w-5 text-blue-500" />} label="Lotería" value={raffle.lottery || "—"} />
                                    <InfoItem icon={<Calendar className="h-5 w-5 text-blue-500" />} label="Inicio" value={raffle.startDate ? formatDate(raffle.startDate) : "—"} />
                                    <InfoItem icon={<Calendar className="h-5 w-5 text-blue-500" />} label="Fin" value={raffle.endDate ? formatDate(raffle.endDate) : "—"} />
                                    <InfoItem icon={<Calendar className="h-5 w-5 text-blue-500" />} label="Sorteo" value={raffle.drawDate ? formatDate(raffle.drawDate) : "—"} />
                                    <InfoItem icon={<Hash className="h-5 w-5 text-amber-500" />} label="Número ganador" value={raffle.winningNumber != null ? String(raffle.winningNumber) : "Sin definir"} />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Usuario en sesión */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" /> Mi cuenta
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <InfoItem icon={<User className="h-5 w-5 text-primary" />} label="Nombre" value={user?.displayName || "—"} />
                            <InfoItem icon={<Mail className="h-5 w-5 text-blue-500" />} label="Correo" value={user?.email || "—"} />
                            <InfoItem icon={<Shield className="h-5 w-5 text-emerald-500" />} label="Rol" value={user?.role ? ROLE_LABELS[user.role] || user.role : "—"} />
                        </div>
                    </CardContent>
                </Card>

                {/* Apariencia */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-default-100"><Palette className="h-5 w-5 text-default-600" /></div>
                                <div>
                                    <p className="font-semibold text-sm">Tema</p>
                                    <p className="text-xs text-default-500">Cambia entre claro y oscuro</p>
                                </div>
                            </div>
                            <ThemeToggle />
                        </div>
                    </CardContent>
                </Card>

                {/* Cerrar sesión */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-danger/10"><LogOut className="h-5 w-5 text-danger" /></div>
                                <div>
                                    <p className="font-semibold text-sm">Cerrar sesión</p>
                                    <p className="text-xs text-default-500">Salir de tu cuenta en este dispositivo</p>
                                </div>
                            </div>
                            <Button variant="danger" size="sm" onPress={() => logout()}>
                                <LogOut className="h-4 w-4" /> Cerrar sesión
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-default-100 shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="text-xs text-default-500">{label}</p>
                <p className="font-semibold text-sm truncate">{value}</p>
            </div>
        </div>
    );
}
