"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, toast } from "@heroui/react";
import { ArrowLeft, Copy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VendorForm } from "@/features/vendors/components/vendor-form";
import { vendorService } from "@/features/vendors/services/vendor.service";
import { callFunction } from "@/services/firebase-callable";
import type { VendorFormData } from "@/features/vendors/schemas/vendor.schema";

/** "Juan Pérez" → "jperez"; "Tomas" → "tomas" */
function generateUsername(fullName: string): string {
    const clean = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}${parts[parts.length - 1]}`;
}

export default function NewVendorPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null);

    const handleSubmit = async (data: VendorFormData) => {
        setServerError(null);
        setIsLoading(true);

        try {
            // 1. Crear la ficha del vendedor
            const { vendorId } = await vendorService.create({
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.phone, // Mismo número como WhatsApp
                userId: "",
            });

            // 2. Generar automáticamente el acceso de login (usuario = del nombre, contraseña = cédula)
            const username = generateUsername(data.name);
            const email = `${username}@rifas.app`;
            const password = data.document.trim();

            const res = await callFunction<{ uid: string }>("createUser", {
                email,
                password,
                displayName: data.name,
                role: "vendor",
                vendorId,
            });

            // 3. Marcar el vendedor con su usuario
            await vendorService.update(vendorId, { userId: res.uid });

            // Mostrar credenciales para compartir
            setCredentials({ name: data.name, username, password });
            toast.success(`Vendedor "${data.name}" creado con acceso`);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Error al crear el vendedor. Intenta de nuevo.";
            setServerError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <PageHeader
                title="Nuevo Vendedor"
                description="Registra un nuevo vendedor en el sistema"
                actions={
                    <Link href="/vendors">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                    </Link>
                }
            />

            {credentials ? (
                // Vendedor creado: mostrar credenciales
                <Card className="border-2 border-success/30 max-w-lg">
                    <CardContent className="p-6">
                        <p className="text-sm font-semibold text-success mb-3">✅ Vendedor &quot;{credentials.name}&quot; creado — comparte estas credenciales:</p>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-xs text-default-500">Usuario</p>
                                <p className="font-mono font-bold text-lg">{credentials.username}</p>
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Contraseña</p>
                                <p className="font-mono font-bold text-lg">{credentials.password}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onPress={async () => {
                                    try {
                                        await navigator.clipboard.writeText(`Usuario: ${credentials.username}\nContraseña: ${credentials.password}`);
                                        toast.success("Credenciales copiadas");
                                    } catch {
                                        toast.danger("No se pudieron copiar");
                                    }
                                }}
                            >
                                <Copy className="h-4 w-4" /> Copiar credenciales
                            </Button>
                            <Button variant="primary" size="sm" onPress={() => router.push("/vendors")}>
                                Ir a vendedores
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                    <VendorForm
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        serverError={serverError}
                    />
            )}
        </div>
    );
}
