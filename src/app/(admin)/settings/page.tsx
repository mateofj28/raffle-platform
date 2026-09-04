"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Separator, toast } from "@heroui/react";
import { User, Mail, Shield, Trophy, DollarSign, Hash, Calendar, Ticket, Palette, LogOut, Pencil, X, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";
import { reauthenticate } from "@/lib/firebase/auth";
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
    const setUser = useAuthStore((s) => s.setUser);
    const { activeRaffle } = useRaffleStore();

    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [loading, setLoading] = useState(true);

    // --- Editar perfil ---
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);

    const openEdit = () => {
        setEditName(user?.displayName || "");
        setEditEmail(user?.email || "");
        setNewPassword("");
        setCurrentPassword("");
        setProfileError(null);
        setEditing(true);
    };

    const emailChanged = editEmail.trim() !== (user?.email || "");
    const wantsPasswordChange = newPassword.length > 0;
    // La reautenticación solo es obligatoria para cambiar correo o contraseña.
    const requiresReauth = emailChanged || wantsPasswordChange;

    const handleSaveProfile = async () => {
        setProfileError(null);

        if (!user?.uid) { setProfileError("No hay sesión activa."); return; }
        if (!editName.trim()) { setProfileError("El nombre es obligatorio."); return; }
        if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
            setProfileError("El correo no es válido."); return;
        }
        if (wantsPasswordChange && newPassword.length < 6) {
            setProfileError("La nueva contraseña debe tener al menos 6 caracteres."); return;
        }
        if (requiresReauth && !currentPassword) {
            setProfileError("Ingresa tu contraseña actual para confirmar los cambios."); return;
        }

        setSavingProfile(true);
        try {
            // Reautenticar antes de cambios sensibles (correo/contraseña)
            if (requiresReauth) {
                try {
                    await reauthenticate(currentPassword);
                } catch {
                    setProfileError("La contraseña actual es incorrecta.");
                    setSavingProfile(false);
                    return;
                }
            }

            const payload: { uid: string; displayName?: string; email?: string; password?: string } = { uid: user.uid };
            payload.displayName = editName.trim();
            if (emailChanged) payload.email = editEmail.trim();
            if (wantsPasswordChange) payload.password = newPassword;

            await callFunction("updateUser", payload);

            // Reflejar cambios de nombre/correo en el store local
            setUser({ ...user, displayName: editName.trim(), email: emailChanged ? editEmail.trim() : user.email });

            toast.success("Perfil actualizado");
            setEditing(false);
            setCurrentPassword("");
            setNewPassword("");
        } catch (e) {
            setProfileError(e instanceof Error ? e.message : "No se pudo actualizar el perfil");
        } finally {
            setSavingProfile(false);
        }
    };

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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" /> Mi cuenta
                            </h3>
                            {!editing && (
                                <Button variant="outline" size="sm" onPress={openEdit}>
                                    <Pencil className="h-4 w-4" /> Editar perfil
                                </Button>
                            )}
                        </div>

                        {!editing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                <InfoItem icon={<User className="h-5 w-5 text-primary" />} label="Nombre" value={user?.displayName || "—"} />
                                <InfoItem icon={<Mail className="h-5 w-5 text-blue-500" />} label="Correo" value={user?.email || "—"} />
                                <InfoItem icon={<Shield className="h-5 w-5 text-emerald-500" />} label="Rol" value={user?.role ? ROLE_LABELS[user.role] || user.role : "—"} />
                            </div>
                        ) : (
                            <div>
                                <FormErrorBanner message={profileError} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Nombre</label>
                                            <Input value={editName} onChange={(e) => setEditName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))} className="w-full" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Correo</label>
                                        <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Nueva contraseña</label>
                                            <div className="relative">
                                                <Input type={showNewPassword ? "text" : "password"} placeholder="Dejar vacío para no cambiar" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pr-10" />
                                                <button type="button" tabIndex={-1} onClick={() => setShowNewPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-default-400 hover:text-default-600 transition-colors" aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                                                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">
                                            Contraseña actual {requiresReauth && <span className="text-danger">*</span>}
                                        </label>
                                            <div className="relative">
                                                <Input type={showCurrentPassword ? "text" : "password"} placeholder={requiresReauth ? "Requerida para confirmar" : "Solo si cambias correo o contraseña"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full pr-10" disabled={!requiresReauth} />
                                                <button type="button" tabIndex={-1} onClick={() => setShowCurrentPassword((v) => !v)} disabled={!requiresReauth} className="absolute right-3 top-1/2 -translate-y-1/2 text-default-400 hover:text-default-600 transition-colors disabled:opacity-40" aria-label={showCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                                                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                    </div>
                                </div>
                                {requiresReauth && (
                                    <p className="text-xs text-default-500 mt-2">Por seguridad, para cambiar el correo o la contraseña debes confirmar con tu contraseña actual.</p>
                                )}
                                <div className="flex gap-2 mt-4">
                                        <Button variant="outline" size="sm" onPress={() => setEditing(false)}><X className="h-4 w-4" /> Cancelar</Button>
                                    <Button variant="primary" size="sm" isDisabled={savingProfile} onPress={handleSaveProfile}>
                                        {savingProfile ? "Guardando..." : "Guardar cambios"}
                                    </Button>
                                </div>
                            </div>
                        )}
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
