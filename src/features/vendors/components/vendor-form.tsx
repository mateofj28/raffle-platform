"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardContent, Separator } from "@heroui/react";
import { Save, User, Phone, Mail } from "lucide-react";
import { vendorSchema, type VendorFormData } from "../schemas/vendor.schema";
import { FormField } from "@/components/ui/form-field";
import { FormErrorBanner } from "@/components/ui/form-error-banner";

interface VendorFormProps {
    defaultValues?: Partial<VendorFormData>;
    onSubmit: (data: VendorFormData) => Promise<void>;
    isLoading?: boolean;
    serverError?: string | null;
    submitLabel?: string;
}

/**
 * Vendor form component.
 * - Open/Closed: extensible via props (defaultValues, submitLabel)
 * - Single Responsibility: only handles vendor form UI + validation
 * - Dependency Inversion: depends on abstractions (onSubmit callback)
 */
export function VendorForm({
    defaultValues,
    onSubmit,
    isLoading = false,
    serverError = null,
    submitLabel = "Guardar Vendedor",
}: VendorFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<VendorFormData>({
        resolver: zodResolver(vendorSchema),
        defaultValues: {
            name: "",
            document: "",
            phone: "",
            whatsapp: "",
            email: "",
            ...defaultValues,
        },
    });

    const busy = isLoading || isSubmitting;

    return (
      <Card className="max-w-2xl">
          <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <FormErrorBanner message={serverError} />

                  {/* Información personal */}
                  <div>
                      <h3 className="text-sm font-semibold text-default-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Información Personal
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                              label="Nombre completo"
                              {...register("name")}
                              placeholder="Juan Pérez"
                              error={errors.name?.message}
                              disabled={busy}
                              required
                          />
                          <FormField
                              label="Documento de identidad"
                              {...register("document")}
                              placeholder="1234567890"
                              error={errors.document?.message}
                              disabled={busy}
                              required
                          />
                      </div>
                  </div>

                  <Separator />

                  {/* Contacto */}
                  <div>
                      <h3 className="text-sm font-semibold text-default-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Contacto
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                              label="Teléfono"
                              {...register("phone")}
                              type="tel"
                              placeholder="3001234567"
                              error={errors.phone?.message}
                              disabled={busy}
                              required
                          />
                          <FormField
                              label="WhatsApp"
                              {...register("whatsapp")}
                              type="tel"
                              placeholder="3001234567"
                              hint="Opcional"
                              error={errors.whatsapp?.message}
                              disabled={busy}
                          />
                      </div>
                  </div>

                  <Separator />

                  {/* Acceso */}
                  <div>
                      <h3 className="text-sm font-semibold text-default-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Acceso al Sistema
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                              label="Correo electrónico"
                              {...register("email")}
                              type="email"
                              placeholder="vendedor@ejemplo.com"
                              hint="Se usará para iniciar sesión"
                              error={errors.email?.message}
                              disabled={busy}
                              required
                          />
                      </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4">
                      <Button type="submit" variant="primary" isDisabled={busy}>
                          <Save className="h-4 w-4" />
                          {busy ? "Guardando..." : submitLabel}
            </Button>
                  </div>
        </form>
          </CardContent>
      </Card>
  );
}
