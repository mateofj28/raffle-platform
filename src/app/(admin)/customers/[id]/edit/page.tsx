"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { customerService } from "@/features/customers/services/customer.service";
import { useAuthStore } from "@/store/auth.store";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { CustomerFormData } from "@/features/customers/schemas/customer.schema";
import type { Customer } from "@/types/api.types";

export default function EditCustomerPage() {
    const params = useParams();
    const router = useRouter();
    const customerId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    useEffect(() => {
        if (!tenantId || !customerId) return;
        const load = async () => {
            try {
                const customerDoc = await getDoc(doc(getDb(), "tenants", tenantId, "customers", customerId));
                if (customerDoc.exists()) {
                    setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tenantId, customerId]);

    const handleSubmit = async (data: CustomerFormData) => {
        setServerError(null);
        setIsSubmitting(true);

        try {
            await customerService.update(customerId, {
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.phone,
                address: data.address || "",
                city: `${data.city}, ${data.department}`,
            });
            router.push(`/customers/${customerId}`);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Error al actualizar el cliente. Intenta de nuevo.";
            setServerError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div>
                <PageHeader title="Editar Cliente" />
                <LoadingSkeleton rows={6} />
            </div>
        );
    }

    if (!customer) {
        return <div><PageHeader title="Cliente no encontrado" /></div>;
    }

    // Parse city field - stored as "City, Department"
    const cityParts = customer.city ? customer.city.split(", ") : [];
    const parsedCity = cityParts[0] || "";
    const parsedDepartment = cityParts[1] || "";

    return (
        <div>
            <PageHeader
                title="Editar Cliente"
                description={`Editando: ${customer.name}`}
                actions={
                    <Link href={`/customers/${customerId}`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                    </Link>
                }
            />
            <CustomerForm
                defaultValues={{
                    name: customer.name,
                    document: customer.document,
                    phone: customer.phone,
                    department: parsedDepartment,
                    city: parsedCity,
                    address: customer.address || "",
                }}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
                serverError={serverError}
                submitLabel="Actualizar Cliente"
            />
        </div>
    );
}
