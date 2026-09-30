"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Separator, toast, DatePicker, DateField, Calendar as HeroCalendar } from "@heroui/react";
import { now, getLocalTimeZone, type CalendarDateTime, type ZonedDateTime } from "@internationalized/date";
import { User, Mail, Shield, Trophy, DollarSign, Hash, Calendar, Ticket, Palette, LogOut, Pencil, X, Eye, EyeOff, Lock, Unlock, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { getRaffleCloseReason } from "@/utils/raffle-lock";
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

    // --- Editar rifa (admin) ---
    const [editingRaffle, setEditingRaffle] = useState(false);
    const [savingRaffle, setSavingRaffle] = useState(false);
    const [raffleError, setRaffleError] = useState<string | null>(null);
    const [rf, setRf] = useState({
        name: "", description: "", prize: "", prizeValue: 0, ticketPrice: 0, startDate: "", endDate: "", lottery: "",
    });

    const openEditRaffle = () => {
        if (!raffle) return;
        setRf({
            name: raffle.name || "",
            description: raffle.description || "",
            prize: raffle.prize || "",
            prizeValue: raffle.prizeValue || 0,
            ticketPrice: raffle.ticketPrice || 0,
            startDate: raffle.startDate || "",
            endDate: raffle.endDate || "",
            lottery: raffle.lottery || "",
        });
        setRaffleError(null);
        setEditingRaffle(true);
    };

    const handleSaveRaffle = async () => {
        if (!raffle) return;
        setRaffleError(null);
        if (!rf.name.trim()) { setRaffleError("El nombre es obligatorio."); return; }
        if (!rf.description.trim()) { setRaffleError("La descripción es obligatoria."); return; }
        if (!rf.prize.trim()) { setRaffleError("El premio es obligatorio."); return; }
        if (rf.ticketPrice <= 0) { setRaffleError("El precio de la boleta debe ser mayor a 0."); return; }
        if (!rf.startDate || !rf.endDate) { setRaffleError("Las fechas de inicio y fin son obligatorias."); return; }
        if (rf.endDate < rf.startDate) { setRaffleError("La fecha fin no puede ser anterior a la de inicio."); return; }

        setSavingRaffle(true);
        try {
            const { raffleService } = await import("@/features/raffles/services/raffle.service");
            await raffleService.update(raffle.id, {
                name: rf.name.trim(),
                description: rf.description.trim(),
                prize: rf.prize.trim(),
                prizeValue: rf.prizeValue,
                ticketPrice: rf.ticketPrice,
                startDate: rf.startDate,
                endDate: rf.endDate,
                lottery: rf.lottery.trim(),
            });
            // Refrescar la rifa mostrada
            setRaffle({ ...raffle, ...rf, drawDate: rf.endDate });
            toast.success("Rifa actualizada");
            setEditingRaffle(false);
        } catch (e) {
            setRaffleError(e instanceof Error ? e.message : "No se pudo actualizar la rifa");
        } finally {
            setSavingRaffle(false);
        }
    };

    // --- Control de cierre/apertura de la rifa (solo admin) ---
    const [savingLock, setSavingLock] = useState(false);
    // Valor del selector fecha+hora (HeroUI). Se serializa a "YYYY-MM-DDTHH:mm" al guardar.
    const [scheduleValue, setScheduleValue] = useState<CalendarDateTime | ZonedDateTime | null>(null);

    // Actualiza los campos de cierre en la rifa y refresca el estado local.
    const updateLock = async (fields: { manualClosed?: boolean; closeAt?: string | null }) => {
        if (!raffle) return;
        setSavingLock(true);
        try {
            const { raffleService } = await import("@/features/raffles/services/raffle.service");
            await raffleService.update(raffle.id, fields);
            setRaffle({ ...raffle, ...fields } as Raffle);
        } catch (e) {
            toast.danger(e instanceof Error ? e.message : "No se pudo actualizar el estado de la rifa");
        } finally {
            setSavingLock(false);
        }
    };

    const handleCloseNow = async () => {
        await updateLock({ manualClosed: true });
        toast.success("Rifa cerrada. Nadie puede operar hasta que la reabras.");
    };

    const handleReopen = async () => {
        // Reabrir = quitar cierre manual y cualquier programación de cierre.
        await updateLock({ manualClosed: false, closeAt: null });
        setScheduleValue(null);
        toast.success("Rifa reabierta. Ya se permiten operaciones.");
    };

    // Convierte el valor del selector a "YYYY-MM-DDTHH:mm" (hora Colombia).
    const toCloseAtString = (v: CalendarDateTime | ZonedDateTime): string => {
        const p2 = (n: number) => String(n).padStart(2, "0");
        return `${v.year}-${p2(v.month)}-${p2(v.day)}T${p2(v.hour)}:${p2(v.minute)}`;
    };

    const handleSchedule = async () => {
        if (!scheduleValue) { toast.danger("Elige una fecha y hora de cierre."); return; }
        await updateLock({ closeAt: toCloseAtString(scheduleValue), manualClosed: false });
        toast.success("Cierre programado guardado.");
    };

    const handleCancelSchedule = async () => {
        await updateLock({ closeAt: null });
        setScheduleValue(null);
        toast.success("Programación de cierre cancelada.");
    };

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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                                <Ticket className="h-4 w-4 text-primary" /> Rifa seleccionada
                            </h3>
                            {/* Solo el admin puede editar la rifa. */}
                            {!editingRaffle && raffle && user?.role === "admin" && (
                                <Button variant="outline" size="sm" onPress={openEditRaffle}>
                                    <Pencil className="h-4 w-4" /> Editar rifa
                                </Button>
                            )}
                        </div>

                        {loading ? (
                            <LoadingSkeleton rows={3} />
                        ) : !raffle ? (
                            <EmptyState title="Sin rifa seleccionada" description="Selecciona una rifa para ver su información" icon={<Ticket className="h-10 w-10" />} />
                            ) : editingRaffle ? (
                                <div className="space-y-4">
                                    <FormErrorBanner message={raffleError} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="text-sm font-medium mb-1 block">Nombre</label>
                                            <Input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} className="w-full" />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="text-sm font-medium mb-1 block">Descripción</label>
                                            <Input value={rf.description} onChange={(e) => setRf({ ...rf, description: e.target.value })} className="w-full" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Premio</label>
                                            <Input value={rf.prize} onChange={(e) => setRf({ ...rf, prize: e.target.value })} className="w-full" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Valor del premio</label>
                                            <Input value={rf.prizeValue ? rf.prizeValue.toLocaleString("es-CO") : ""} onChange={(e) => setRf({ ...rf, prizeValue: parseInt(e.target.value.replace(/\D/g, "") || "0") })} inputMode="numeric" className="w-full" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Precio boleta</label>
                                            <Input value={rf.ticketPrice ? rf.ticketPrice.toLocaleString("es-CO") : ""} onChange={(e) => setRf({ ...rf, ticketPrice: parseInt(e.target.value.replace(/\D/g, "") || "0") })} inputMode="numeric" className="w-full" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Lotería</label>
                                            <Input value={rf.lottery} onChange={(e) => setRf({ ...rf, lottery: e.target.value })} className="w-full" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Fecha inicio</label>
                                            <Input type="date" value={rf.startDate} onChange={(e) => setRf({ ...rf, startDate: e.target.value })} className="w-full" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Fecha fin (día del sorteo)</label>
                                            <Input type="date" value={rf.endDate} onChange={(e) => setRf({ ...rf, endDate: e.target.value })} className="w-full" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                        <Button variant="primary" isDisabled={savingRaffle} onPress={handleSaveRaffle}>
                                            {savingRaffle ? "Guardando..." : "Guardar cambios"}
                                        </Button>
                                        <Button variant="ghost" isDisabled={savingRaffle} onPress={() => setEditingRaffle(false)}>Cancelar</Button>
                                    </div>
                                </div>
                        ) : (
                            <>
                                            <p className="text-lg font-bold mb-4">{raffle.name}</p>
                                {raffle.description && <p className="text-sm text-default-500 mb-4">{raffle.description}</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                    <InfoItem icon={<Trophy className="h-5 w-5 text-purple-500" />} label="Premio" value={raffle.prize || "—"} />
                                    <InfoItem icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Valor del premio" value={raffle.prizeValue ? formatCurrency(raffle.prizeValue) : "—"} />
                                    <InfoItem icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Precio boleta" value={formatCurrency(raffle.ticketPrice)} />
                                    <InfoItem icon={<Hash className="h-5 w-5 text-amber-500" />} label="Total boletas" value={raffle.totalTickets.toLocaleString("es-CO")} />
                                    <InfoItem icon={<Hash className="h-5 w-5 text-amber-500" />} label="Números por boleta" value={String(raffle.numbersPerTicket)} />
                                    <InfoItem icon={<Trophy className="h-5 w-5 text-blue-500" />} label="Lotería" value={raffle.lottery || "—"} />
                                    <InfoItem icon={<Calendar className="h-5 w-5 text-blue-500" />} label="Inicio" value={raffle.startDate ? formatDate(raffle.startDate) : "—"} />
                                                <InfoItem icon={<Calendar className="h-5 w-5 text-blue-500" />} label="Fin (día del sorteo)" value={raffle.endDate ? formatDate(raffle.endDate) : "—"} />
                                    <InfoItem icon={<Hash className="h-5 w-5 text-amber-500" />} label="Número ganador" value={raffle.winningNumber != null ? String(raffle.winningNumber) : "Sin definir"} />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Estado de la rifa: cerrar/reabrir/programar (solo admin) */}
                {raffle && user?.role === "admin" && (() => {
                    const r = raffle as Raffle & { manualClosed?: boolean; closeAt?: string | null };
                    const reason = getRaffleCloseReason({ endDate: r.endDate, drawDate: r.drawDate, manualClosed: r.manualClosed, closeAt: r.closeAt });
                    const closed = reason !== null;
                    const reasonText = reason === "manual"
                        ? "Cerrada manualmente por el administrador."
                        : reason === "scheduled"
                            ? "Cerrada por la fecha/hora programada."
                            : reason === "draw"
                                ? "Cerrada por el día del sorteo (8:00 p.m.)."
                                : "";
                    // Cierre programado pendiente (aún no llegó la hora).
                    const scheduledPending = !!r.closeAt && reason !== "scheduled";
                    return (
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                                        {closed ? <Lock className="h-4 w-4 text-danger" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                                        Estado de la rifa
                                    </h3>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${closed ? "bg-danger/10 text-danger" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                                        {closed ? "CERRADA" : "ABIERTA"}
                                    </span>
                                </div>

                                {closed && (
                                    <p className="text-sm text-default-500 mb-4">{reasonText} Nadie puede asignar, vender ni registrar pagos hasta reabrirla.</p>
                                )}
                                {!closed && (
                                    <p className="text-sm text-default-500 mb-4">La rifa está operativa. Puedes cerrarla ahora o programar un cierre a una fecha y hora.</p>
                                )}

                                {/* Cerrar ahora / Reabrir */}
                                <div className="flex flex-wrap items-center gap-3">
                                    {closed ? (
                                        <Button variant="primary" isDisabled={savingLock} onPress={handleReopen}>
                                            <Unlock className="h-4 w-4" /> {savingLock ? "Procesando..." : "Reabrir rifa"}
                                        </Button>
                                    ) : (
                                        <Button variant="danger" isDisabled={savingLock} onPress={handleCloseNow}>
                                            <Lock className="h-4 w-4" /> {savingLock ? "Procesando..." : "Cerrar ahora"}
                                        </Button>
                                    )}
                                </div>

                                <Separator className="my-5" />

                                {/* Programar cierre */}
                                <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-default-500" /> Programar cierre</h4>
                                    {scheduledPending ? (
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            <p className="text-sm text-default-600">
                                                Cierre programado para <span className="font-semibold">{r.closeAt?.replace("T", " ")}</span> (hora Colombia).
                                            </p>
                                            <Button variant="outline" size="sm" isDisabled={savingLock} onPress={handleCancelSchedule}>Cancelar programación</Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                                <div className="w-full sm:w-auto">
                                                <label className="text-xs text-default-500 mb-1 block">Fecha y hora de cierre (Colombia)</label>
                                                    <DatePicker
                                                        value={scheduleValue}
                                                        onChange={setScheduleValue}
                                                        granularity="minute"
                                                        hourCycle={12}
                                                        minValue={now(getLocalTimeZone())}
                                                        aria-label="Fecha y hora de cierre"
                                                        className="w-full sm:w-72"
                                                    >
                                                        <DateField.Group>
                                                            <DateField.Input>
                                                                {(segment) => <DateField.Segment segment={segment} />}
                                                            </DateField.Input>
                                                            <DatePicker.Trigger>
                                                                <DatePicker.TriggerIndicator />
                                                            </DatePicker.Trigger>
                                                        </DateField.Group>
                                                        <DatePicker.Popover>
                                                            <HeroCalendar>
                                                                <HeroCalendar.Header>
                                                                    <HeroCalendar.NavButton slot="previous" />
                                                                    <HeroCalendar.Heading />
                                                                    <HeroCalendar.NavButton slot="next" />
                                                                </HeroCalendar.Header>
                                                                <HeroCalendar.Grid>
                                                                    <HeroCalendar.GridHeader>
                                                                        {() => <HeroCalendar.HeaderCell />}
                                                                    </HeroCalendar.GridHeader>
                                                                    <HeroCalendar.GridBody>
                                                                        {(date) => <HeroCalendar.Cell date={date} />}
                                                                    </HeroCalendar.GridBody>
                                                                </HeroCalendar.Grid>
                                                            </HeroCalendar>
                                                        </DatePicker.Popover>
                                                    </DatePicker>
                                            </div>
                                                <Button variant="primary" isDisabled={savingLock || !scheduleValue} onPress={handleSchedule}>Programar</Button>
                                        </div>
                                    )}
                                    <p className="text-xs text-default-400 mt-2">Si no programas nada, la rifa se cierra sola el día del sorteo a las 8:00 p.m.</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* Usuario en sesión */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" /> Mi cuenta
                            </h3>
                            {/* Solo el admin puede editar su perfil. El cajero lo ve en modo lectura. */}
                            {!editing && user?.role === "admin" && (
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
