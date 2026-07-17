"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { customerService } from "@/features/customers/services/customer.service";
import type { CustomerFormData } from "@/features/customers/schemas/customer.schema";

export default function NewCustomerPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const handleSubmit = async (data: CustomerFormData) => {
        setServerError(null);
        setIsLoading(true);

        try {
            await customerService.create({
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.whatsapp || "",
                address: data.address || "",
                city: data.city || "",
            });
            router.push("/customers");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Error al crear el cliente. Intenta de nuevo.";
            setServerError(message);
        } finally {
            setIsLoading(false);
        }
    };

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
