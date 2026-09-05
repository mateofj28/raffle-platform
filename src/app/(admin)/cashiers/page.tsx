"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, AlertDialog } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { UserCog, Plus, Trash2, Pencil, Copy } from "lucide-react";
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
    const [document, setDocument] = useState("");
    const [phone, setPhone] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
    const [editingCashier, setEditingCashier] = useState<CashierUser | null>(null);
    const [deleteCashier, setDeleteCashier] = useState<CashierUser | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [editingAction, setEditingAction] = useState(false);

    // Búsqueda y paginación
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    function capitalizeWords(text: string): string {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    /**
     * Generates a username from the full name.
     * "Juan Pérez" → "jperez"
     * "María Alejandra Torres" → "mtorres"
     */
    function generateUsername(fullName: string): string {
        const clean = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "";
        if (parts.length === 1) return parts[0];
        const firstInitial = parts[0][0];
        const lastName = parts[parts.length - 1];
        return `${firstInitial}${lastName}`;
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
        if (!name.trim() || !document.trim() || !phone.trim()) {
            setError("Todos los campos son obligatorios");
            return;
        }
        if (document.trim().length < 6) {
            setError("La cédula debe tener al menos 6 dígitos");
            return;
        }

        setCreating(true);
        setError(null);
        setCreatedCredentials(null);

        const username = generateUsername(name.trim());
        const email = `${username}@rifas.app`;
        const password = document.trim();

        try {
            await callFunction("createUser", {
                email,
                password,
                displayName: name.trim(),
                role: "cashier",
            });
            toast.success(`Cajero "${name}" creado exitosamente`);
            setCreatedCredentials({ username, password });
            setShowForm(false);
            setName("");
            setDocument("");
            setPhone("");
            await loadCashiers();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Error al crear el cajero";
            setError(msg);
            toast.danger(msg);
        } finally {
            setCreating(false);
        }
    };

    // Filtrado por nombre/correo y paginación
    const filteredCashiers = search.trim()
        ? cashiers.filter(c => {
            const term = search.toLowerCase();
            return (c.displayName || "").toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term);
        })
        : cashiers;
    const totalPages = Math.ceil(filteredCashiers.length / PAGE_SIZE);
    const paginatedCashiers = filteredCashiers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
                                <label className="text-sm font-medium mb-1 block">Cédula</label>
                                <Input
                                    type="text"
                                    placeholder="Ej: 1004445566"
                                    value={document}
                                    onChange={(e) => setDocument(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                    inputMode="numeric"
                                    maxLength={10}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Teléfono</label>
                                <Input
                                    type="text"
                                    placeholder="Ej: 3001234567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                    inputMode="numeric"
                                    maxLength={10}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        {name.trim() && (
                            <p className="text-xs text-default-500 mt-2">
                                Usuario generado: <span className="font-mono font-semibold">{generateUsername(name.trim())}</span> — Contraseña: la cédula
                            </p>
                        )}
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

            {/* Credentials display after creation */}
            {createdCredentials && (
                <Card className="mb-6 border-2 border-success/30">
                    <CardContent className="p-4">
                        <p className="text-sm font-semibold text-success mb-2">✅ Cajero creado — Comparte estas credenciales:</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-default-500">Usuario</p>
                                <p className="font-mono font-bold text-lg">{createdCredentials.username}</p>
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Contraseña</p>
                                <p className="font-mono font-bold text-lg">{createdCredentials.password}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onPress={async () => {
                                    try {
                                        await navigator.clipboard.writeText(`Usuario: ${createdCredentials.username}\nContraseña: ${createdCredentials.password}`);
                                        toast.success("Credenciales copiadas");
                                    } catch {
                                        toast.danger("No se pudieron copiar");
                                    }
                                }}
                            >
                                <Copy className="h-4 w-4" /> Copiar credenciales
                            </Button>
                            <Button variant="danger" size="sm" onPress={() => setCreatedCredentials(null)}>
                                Cerrar
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
                    <>
                        {/* Buscador */}
                        <div className="mb-4">
                            <Input
                                placeholder="Buscar cajero por nombre o correo..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="max-w-md"
                            />
                        </div>

                        {filteredCashiers.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-default-500 text-sm">No se encontraron cajeros con ese criterio</p>
                            </div>
                        ) : (
                <div className="space-y-3">
                                    {paginatedCashiers.map((cashier) => (
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

                                    {/* Paginación */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between pt-2">
                                            <p className="text-xs text-default-500">
                                                {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredCashiers.length)} de {filteredCashiers.length}
                                            </p>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" isDisabled={page === 1} onPress={() => setPage(p => p - 1)}>Anterior</Button>
                                                <span className="text-xs text-default-500 flex items-center px-2">{page} / {totalPages}</span>
                                                <Button variant="ghost" size="sm" isDisabled={page === totalPages} onPress={() => setPage(p => p + 1)}>Siguiente</Button>
                                            </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
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
