"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { VendorForm } from "@/features/vendors/components/vendor-form";
import { vendorService } from "@/features/vendors/services/vendor.service";
import { useAuthStore } from "@/store/auth.store";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { VendorFormData } from "@/features/vendors/schemas/vendor.schema";
import type { Vendor } from "@/types/api.types";

export default function EditVendorPage() {
    const params = useParams();
    const router = useRouter();
    const vendorId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    useEffect(() => {
        if (!tenantId || !vendorId) return;
        const load = async () => {
            try {
                const vendorDoc = await getDoc(doc(getDb(), "tenants", tenantId, "vendors", vendorId));
                if (vendorDoc.exists()) {
                    setVendor({ id: vendorDoc.id, ...vendorDoc.data() } as Vendor);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tenantId, vendorId]);

    const handleSubmit = async (data: VendorFormData) => {
        setServerError(null);
        setIsSubmitting(true);

        try {
            await vendorService.update(vendorId, {
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.phone,
            });
            router.push(`/vendors/${vendorId}`);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Error al actualizar el vendedor. Intenta de nuevo.";
            setServerError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div>
                <PageHeader title="Editar Vendedor" />
                <LoadingSkeleton rows={6} />
            </div>
        );
    }

    if (!vendor) {
        return <div><PageHeader title="Vendedor no encontrado" /></div>;
    }

    return (
        <div>
            <PageHeader
                title="Editar Vendedor"
                description={`Editando: ${vendor.name}`}
                actions={
                    <Link href={`/vendors/${vendorId}`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                    </Link>
                }
            />
            <VendorForm
                defaultValues={{
                    name: vendor.name,
                    document: vendor.document,
                    phone: vendor.phone,
                    email: "",
                }}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
                serverError={serverError}
                submitLabel="Actualizar Vendedor"
            />
        </div>
    );
}
