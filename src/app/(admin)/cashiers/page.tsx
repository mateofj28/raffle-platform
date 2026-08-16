"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Input, AlertDialog } from "@heroui/react";
import { UserCog, Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { useAuthStore } from "@/store/auth.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import { toast } from "@heroui/react";

interface CashierUser {
    id: string;
    email: string;
    displayName: string;
    role: string;
    disabled: boolean;
    createdAt: string;
}

export default function CashiersPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [cashiers, setCashiers] = useState<CashierUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Create form
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [editingCashier, setEditingCashier] = useState<CashierUser | null>(null);
    const [deleteCashier, setDeleteCashier] = useState<CashierUser | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [editingAction, setEditingAction] = useState(false);

    function capitalizeWords(text: string): string {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    const loadCashiers = async () => {
        if (!tenantId) return;
        try {
            const col = tenantCollection(tenantId, "users");
            const q = query(col, where("role", "==", "cashier"));
            const snap = await getDocs(q);
            setCashiers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CashierUser[]);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        loadCashiers();
    }, [tenantId]);

    const handleCreate = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            setError("Todos los campos son obligatorios");
            return;
        }
        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setCreating(true);
        setError(null);

        try {
            await callFunction("createUser", {
                email: email.trim(),
                password,
                displayName: name.trim(),
                role: "cashier",
            });
            toast.success(`Cajero "${name}" creado exitosamente`);
            setShowForm(false);
            setName("");
            setEmail("");
            setPassword("");
            await loadCashiers();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Error al crear el cajero";
            setError(msg);
            toast.danger(msg);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div><PageHeader title="Cajeros" /><LoadingSkeleton rows={4} /></div>;

    return (
        <div>
            <PageHeader
                title="Cajeros"
                description="Usuarios que operan el sistema (venden, cobran, asignan boletas)"
                actions={
                    !showForm ? (
                        <Button variant="primary" size="sm" onPress={() => setShowForm(true)}>
                            <Plus className="h-4 w-4" /> Nuevo Cajero
                        </Button>
                    ) : undefined
                }
            />

            {/* Create form */}
            {showForm && (
                <Card className="mb-6 border-2 border-primary/30">
                    <CardContent className="p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">Crear nuevo cajero</h3>
                        <FormErrorBanner message={error} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Nombre completo</label>
                                <Input
                                    placeholder="Ej: Alejandra Iglesias"
                                    value={name}
                                    onChange={(e) => setName(capitalizeWords(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Correo electrónico</label>
                                <Input
                                    type="email"
                                    placeholder="cajero@rifas.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Contraseña</label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Mínimo 6 caracteres"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-default-400 hover:text-foreground"
                                    >
                                        {showPassword ? "Ocultar" : "Ver"}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button variant="primary" isDisabled={creating} onPress={handleCreate}>
                                {creating ? "Creando..." : "Crear cajero"}
                            </Button>
                            <Button variant="ghost" onPress={() => { setShowForm(false); setError(null); }}>
                                Cancelar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cashiers list */}
            {cashiers.length === 0 && !showForm ? (
                <EmptyState
                    title="Sin cajeros"
                    description="Crea un cajero para que pueda operar el sistema (vender, cobrar, asignar boletas)"
                    icon={<UserCog className="h-12 w-12" />}
                    action={
                        <Button variant="primary" onPress={() => setShowForm(true)}>
                            <Plus className="h-4 w-4" /> Crear primer cajero
                        </Button>
                    }
                />
            ) : cashiers.length > 0 && (
                <div className="space-y-3">
                    {cashiers.map((cashier) => (
                        <Card key={cashier.id}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-full bg-primary/10">
                                            <UserCog className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">{cashier.displayName}</p>
                                            <p className="text-xs text-default-500">{cashier.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${cashier.disabled ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                                            {cashier.disabled ? "Inactivo" : "Activo"}
                                        </span>
                                        <Button variant="ghost" size="sm" isIconOnly onPress={() => {
                                            setEditingCashier(cashier);
                                            setEditName(cashier.displayName);
                                            setEditEmail(cashier.email);
                                            setEditPassword("");
                                            setShowEditPassword(false);
                                        }} aria-label="Editar">
                                            <Pencil className="h-4 w-4 text-amber-400" />
                                        </Button>
                                        <Button variant="ghost" size="sm" isIconOnly onPress={() => setDeleteCashier(cashier)} aria-label="Eliminar">
                                            <Trash2 className="h-4 w-4 text-danger" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit dialog */}
            <AlertDialog.Backdrop isOpen={editingCashier !== null} onOpenChange={(open) => { if (!open) setEditingCashier(null); }} isDismissable>
                <AlertDialog.Container placement="center" size="md">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Editar cajero</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Nombre</label>
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(capitalizeWords(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Correo electrónico</label>
                                    <Input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Nueva contraseña <span className="text-default-400 font-normal">(dejar vacío para no cambiar)</span></label>
                                    <div className="relative">
                                        <Input
                                            type={showEditPassword ? "text" : "password"}
                                            placeholder="Mínimo 6 caracteres"
                                            value={editPassword}
                                            onChange={(e) => setEditPassword(e.target.value)}
                                            className="w-full"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEditPassword(!showEditPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-default-400 hover:text-foreground"
                                        >
                                            {showEditPassword ? "Ocultar" : "Ver"}
                                        </button>
                                    </div>
                                    {editPassword && editPassword.length < 6 && (
                                        <p className="text-xs text-danger mt-1">Mínimo 6 caracteres</p>
                                    )}
                                </div>
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cancelar</Button>
                            <Button variant="primary" isDisabled={!editName.trim() || !editEmail.trim() || (editPassword.length > 0 && editPassword.length < 6) || editingAction} onPress={async () => {
                                if (!editingCashier || !tenantId) return;
                                setEditingAction(true);
                                try {
                                    await callFunction("updateUser", {
                                        uid: editingCashier.id,
                                        displayName: editName.trim(),
                                        email: editEmail.trim(),
                                        ...(editPassword.length >= 6 ? { password: editPassword } : {}),
                                    });
                                    toast.success("Cajero actualizado");
                                    setEditingCashier(null);
                                    await loadCashiers();
                                } catch (e) {
                                    toast.danger(e instanceof Error ? e.message : "Error al actualizar");
                                } finally { setEditingAction(false); }
                            }}>
                                {editingAction ? "Guardando..." : "Guardar cambios"}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>

            {/* Delete confirmation */}
            <AlertDialog.Backdrop isOpen={deleteCashier !== null} onOpenChange={(open) => { if (!open) setDeleteCashier(null); }} isDismissable>
                <AlertDialog.Container placement="center" size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>¿Eliminar cajero?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>Se desactivará la cuenta de <strong>{deleteCashier?.displayName}</strong>. Ya no podrá iniciar sesión.</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cancelar</Button>
                            <Button variant="danger" isDisabled={editingAction} onPress={async () => {
                                if (!deleteCashier || !tenantId) return;
                                setEditingAction(true);
                                try {
                                    const { doc: firestoreDoc, updateDoc } = await import("firebase/firestore");
                                    const userRef = firestoreDoc(getDb(), "tenants", tenantId, "users", deleteCashier.id);
                                    await updateDoc(userRef, { disabled: true });
                                    toast.success("Cajero desactivado");
                                    setDeleteCashier(null);
                                    await loadCashiers();
                                } catch (e) {
                                    toast.danger("Error al desactivar");
                                } finally { setEditingAction(false); }
                            }}>
                                {editingAction ? "Eliminando..." : "Desactivar cajero"}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </div>
    );
}
