"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { useAuthStore } from "@/store/auth.store";
import { callFunction } from "@/services/firebase-callable";
import { toast } from "@heroui/react";

export default function VendorCreateCustomerPage() {
    const router = useRouter();
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [name, setName] = useState("");
    const [document, setDocument] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function capitalizeWords(text: string): string {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    const handleCreate = async () => {
        if (!name.trim() || !document.trim() || !phone.trim()) {
            setError("Nombre, documento y teléfono son obligatorios");
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
            toast.success(`Cliente "${name}" creado exitosamente`);
            setName("");
            setDocument("");
            setPhone("");
            setCity("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al crear cliente");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto">
            <PageHeader title="Crear Cliente" description="Registra un nuevo cliente" />

            <Card>
                <CardContent className="p-6">
                    <FormErrorBanner message={error} />
                    <div className="space-y-4 mt-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Nombre completo</label>
                            <Input
                                placeholder="Ej: Juan Pérez"
                                value={name}
                                onChange={(e) => setName(capitalizeWords(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Cédula</label>
                            <Input
                                placeholder="Ej: 1004445566"
                                value={document}
                                onChange={(e) => setDocument(e.target.value.replace(/\D/g, ""))}
                                inputMode="numeric"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Teléfono</label>
                            <Input
                                placeholder="Ej: 3001234567"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                inputMode="numeric"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Ciudad (opcional)</label>
                            <Input
                                placeholder="Ej: Bogotá"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="mt-6">
                        <Button variant="primary" isDisabled={creating} onPress={handleCreate} className="w-full">
                            <UserPlus className="h-4 w-4" />
                            {creating ? "Creando..." : "Crear cliente"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
