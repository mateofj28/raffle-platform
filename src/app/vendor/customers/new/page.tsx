"use client";

import { useState } from "react";
import { Button, Card, CardContent } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { UserPlus, User, Hash, Phone, MapPin, CheckCircle } from "lucide-react";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { useAuthStore } from "@/store/auth.store";
import { callFunction } from "@/services/firebase-callable";
import { toast } from "@heroui/react";

export default function VendorCreateCustomerPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [name, setName] = useState("");
    const [document, setDocument] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState(false);

    function capitalizeWords(text: string): string {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    const handleCreate = async () => {
        if (!name.trim() || !document.trim() || !phone.trim()) {
            setError("Nombre, cédula y teléfono son obligatorios");
            return;
        }
        if (document.trim().length < 6) {
            setError("La cédula debe tener al menos 6 dígitos");
            return;
        }

        setCreating(true);
        setError(null);

        try {
            await callFunction("createCustomer", {
                name: name.trim(),
                document: document.trim(),
                phone: phone.trim(),
                whatsapp: phone.trim(),
                address: "",
                city: city.trim(),
            });
            toast.success(`Cliente "${name}" creado`);
            setCreated(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al crear cliente");
        } finally {
            setCreating(false);
        }
    };

    const handleReset = () => {
        setName("");
        setDocument("");
        setPhone("");
        setCity("");
        setCreated(false);
        setError(null);
    };

    // Success state
    if (created) {
        return (
            <div className="max-w-md mx-auto mt-12">
                <Card>
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">¡Cliente creado!</h2>
                        <p className="text-sm text-default-500 mb-1">{name}</p>
                        <p className="text-xs text-default-400 mb-6">CC {document} · Tel {phone}</p>
                        <Button variant="primary" onPress={handleReset} className="w-full">
                            <UserPlus className="h-4 w-4" /> Crear otro cliente
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-8">
            {/* Header visual */}
            <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#0058CD" }}>
                    <UserPlus className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-2xl font-bold">Nuevo cliente</h1>
                <p className="text-sm text-default-500 mt-1">Registra los datos del comprador</p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <FormErrorBanner message={error} />

                    <div className="space-y-5 mt-2">
                        {/* Nombre */}
                        <div>
                            <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                <User className="h-4 w-4 text-default-400" /> Nombre completo
                            </label>
                            <Input
                                placeholder="Ej: Juan Camilo Ríos"
                                value={name}
                                onChange={(e) => setName(capitalizeWords(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        {/* Cédula + Teléfono row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <Hash className="h-4 w-4 text-default-400" /> Cédula
                                </label>
                                <Input
                                    placeholder="1004445566"
                                    value={document}
                                    onChange={(e) => setDocument(e.target.value.replace(/\D/g, ""))}
                                    inputMode="numeric"
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-default-400" /> Teléfono
                                </label>
                                <Input
                                    placeholder="3001234567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                    inputMode="numeric"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Ciudad */}
                        <div>
                            <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-default-400" /> Ciudad
                                <span className="text-xs text-default-400 font-normal">(opcional)</span>
                            </label>
                            <Input
                                placeholder="Ej: Bogotá"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="mt-8">
                        <Button
                            variant="primary"
                            isDisabled={creating || !name.trim() || !document.trim() || !phone.trim()}
                            onPress={handleCreate}
                            className="w-full"
                        >
                            <UserPlus className="h-4 w-4" />
                            {creating ? "Creando..." : "Registrar cliente"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
