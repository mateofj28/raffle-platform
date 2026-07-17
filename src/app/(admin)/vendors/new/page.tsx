"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VendorForm } from "@/features/vendors/components/vendor-form";
import { vendorService } from "@/features/vendors/services/vendor.service";
import type { VendorFormData } from "@/features/vendors/schemas/vendor.schema";

export default function NewVendorPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const handleSubmit = async (data: VendorFormData) => {
        setServerError(null);
        setIsLoading(true);

        try {
            await vendorService.create({
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.whatsapp || "",
                userId: "", // Will be linked when user is created in Auth
            });
            router.push("/vendors");
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
          <VendorForm
              onSubmit={handleSubmit}
              isLoading={isLoading}
              serverError={serverError}
          />
      </div>
  );
}
