"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@heroui/react";
import { ArrowLeft, CheckCircle2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { AddTicketsToCustomer } from "@/features/customers/components/add-tickets-to-customer";
import { customerService } from "@/features/customers/services/customer.service";
import type { CustomerFormData } from "@/features/customers/schemas/customer.schema";

export default function NewCustomerPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    // Cliente recién creado: al existir, pasamos al paso 2 (agregar boletas).
    const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

    const handleSubmit = async (data: CustomerFormData) => {
        setServerError(null);
        setIsLoading(true);
        try {
            const res = await customerService.create({
                name: data.name,
                document: data.document,
                phoneCountry: data.phoneCountry,
                phone: data.phone,
                whatsapp: data.phone,
                address: data.address || "",
                city: `${data.city}, ${data.department}`,
            });
            setCreated({ id: res.customerId, name: data.name });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Error al crear el cliente. Intenta de nuevo.";
            setServerError(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Paso 2: cliente creado → agregar boletas.
    if (created) {
        return (
            <div>
                <PageHeader
                    title="Cliente creado"
                    description="Ahora puedes agregarle boletas (opcional)"
                    actions={
                        <Link href="/customers">
                            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Ir a clientes</Button>
                        </Link>
                    }
                />

                <div className="space-y-5 max-w-2xl">
                    <Card className="border border-emerald-500/30 bg-emerald-500/5">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">{created.name} fue creado</p>
                                <p className="text-xs text-default-500">Agrega las boletas que ya tengan vendedor, o finaliza.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <AddTicketsToCustomer
                        customerId={created.id}
                        customerName={created.name}
                        onDone={() => router.push(`/customers/${created.id}`)}
                    />

                    <div className="flex items-center gap-3">
                        <Button variant="outline" onPress={() => { setCreated(null); setServerError(null); }}>
                            <UserPlus className="h-4 w-4" /> Crear otro cliente
                        </Button>
                        <Button variant="ghost" onPress={() => router.push("/customers")}>Finalizar</Button>
                    </div>
                </div>
            </div>
        );
    }

    // Paso 1: formulario de creación.
    return (
        <div>
            <PageHeader
                title="Nuevo Cliente"
                description="Registra un nuevo cliente en el sistema"
                actions={
                    <Link href="/customers">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                    </Link>
                }
            />
            <CustomerForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                serverError={serverError}
            />
        </div>
    );
}
