"use client";

import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  Button,
  Card,
  CardContent,
  Separator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
} from "@heroui/react";
import { Save, User, Phone, MapPin, ChevronDown } from "lucide-react";
import { customerSchema, type CustomerFormData } from "../schemas/customer.schema";
import { FormField } from "@/components/ui/form-field";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { DEPARTMENT_LIST, getCitiesByDepartment } from "@/constants/colombia-locations";

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
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      document: "",
      phone: "",
      department: "",
      city: "",
      address: "",
      ...defaultValues,
    },
  });

  const busy = isLoading || isSubmitting;

  const selectedDepartment = useWatch({ control, name: "department" });
  const cities = selectedDepartment ? getCitiesByDepartment(selectedDepartment) : [];

  // Reset city when department changes
  useEffect(() => {
    if (selectedDepartment && !defaultValues?.department) {
      setValue("city", "");
    }
  }, [selectedDepartment, setValue, defaultValues?.department]);

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
              {/* Departamento */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Departamento<span className="text-danger ml-0.5">*</span>
                </label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => (
                    <Select
                      aria-label="Departamento"
                      selectedKey={field.value || null}
                      onSelectionChange={(key) => field.onChange(String(key ?? ""))}
                      isDisabled={busy}
                      placeholder="Seleccionar departamento"
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                        <SelectIndicator>
                          <ChevronDown className="h-4 w-4" />
                        </SelectIndicator>
                      </SelectTrigger>
                      <SelectPopover>
                        <ListBox>
                          {DEPARTMENT_LIST.map((dept) => (
                            <ListBoxItem key={dept} id={dept} textValue={dept}>
                              {dept}
                            </ListBoxItem>
                          ))}
                        </ListBox>
                      </SelectPopover>
                    </Select>
                  )}
                />
                {errors.department && (
                  <p className="text-xs text-danger" role="alert">{errors.department.message}</p>
                )}
              </div>

              {/* Ciudad */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Ciudad<span className="text-danger ml-0.5">*</span>
                </label>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <Select
                      aria-label="Ciudad"
                      selectedKey={field.value || null}
                      onSelectionChange={(key) => field.onChange(String(key ?? ""))}
                      isDisabled={busy || !selectedDepartment}
                      placeholder={selectedDepartment ? "Seleccionar ciudad" : "Primero elige departamento"}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                        <SelectIndicator>
                          <ChevronDown className="h-4 w-4" />
                        </SelectIndicator>
                      </SelectTrigger>
                      <SelectPopover>
                        <ListBox>
                          {cities.map((city) => (
                            <ListBoxItem key={city} id={city} textValue={city}>
                              {city}
                            </ListBoxItem>
                          ))}
                        </ListBox>
                      </SelectPopover>
                    </Select>
                  )}
                />
                {errors.city && (
                  <p className="text-xs text-danger" role="alert">{errors.city.message}</p>
                )}
              </div>
            </div>

            {/* Dirección - full width */}
            <div className="mt-4">
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
