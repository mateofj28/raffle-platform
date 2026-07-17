"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardContent, Separator } from "@heroui/react";
import { Save, User, Phone, MapPin } from "lucide-react";
import { customerSchema, type CustomerFormData } from "../schemas/customer.schema";
import { FormField } from "@/components/ui/form-field";
import { FormErrorBanner } from "@/components/ui/form-error-banner";

interface CustomerFormProps {
  defaultValues?: Partial<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => Promise<void>;
  isLoading?: boolean;
  serverError?: string | null;
  submitLabel?: string;
}

export function CustomerForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  serverError = null,
  submitLabel = "Guardar Cliente",
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      document: "",
      phone: "",
      address: "",
      city: "",
      ...defaultValues,
    },
  });

  const busy = isLoading || isSubmitting;

  const numericOnly = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!/[\d\b]/.test(e.key) && !["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }
  };

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
                placeholder="María García"
                error={errors.name?.message}
                disabled={busy}
                required
              />
              <FormField
                label="Cédula"
                {...register("document")}
                placeholder="1234567890"
                hint="Solo números, máximo 10 dígitos"
                error={errors.document?.message}
                disabled={busy}
                required
                maxLength={10}
                inputMode="numeric"
                onKeyDown={numericOnly}
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
                label="Teléfono / WhatsApp"
                {...register("phone")}
                type="tel"
                placeholder="3001234567"
                hint="Solo números, máximo 10 dígitos"
                error={errors.phone?.message}
                disabled={busy}
                required
                maxLength={10}
                inputMode="numeric"
                onKeyDown={numericOnly}
              />
            </div>
          </div>

          <Separator />

          {/* Ubicación */}
          <div>
            <h3 className="text-sm font-semibold text-default-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ubicación
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Ciudad"
                {...register("city")}
                placeholder="Bogotá"
                hint="Opcional"
                error={errors.city?.message}
                disabled={busy}
              />
              <div className="md:col-span-2">
                <FormField
                  label="Dirección"
                  {...register("address")}
                  placeholder="Calle 123 #45-67, Barrio Centro"
                  hint="Opcional"
                  error={errors.address?.message}
                  disabled={busy}
                />
              </div>
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
