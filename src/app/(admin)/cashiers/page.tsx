"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Input, AlertDialog } from "@heroui/react";
import { UserCog, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { useAuthStore } from "@/store/auth.store";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
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
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${cashier.disabled ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                                        {cashier.disabled ? "Inactivo" : "Activo"}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
