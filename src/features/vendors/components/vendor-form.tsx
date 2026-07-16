"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@heroui/react";
import { Save } from "lucide-react";
import { vendorSchema, type VendorFormData } from "../schemas/vendor.schema";

interface VendorFormProps {
    defaultValues?: Partial<VendorFormData>;
    onSubmit: (data: VendorFormData) => void | Promise<void>;
    isLoading?: boolean;
}

export function VendorForm({ defaultValues, onSubmit, isLoading }: VendorFormProps) {
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
            <div className="space-y-1">
                <Input
                    {...register("name")}
                    placeholder="Nombre completo"
                    aria-label="Nombre"
                    disabled={busy}
                />
                {errors.name && (
                    <p className="text-sm text-danger">{errors.name.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Input
                    {...register("document")}
                    placeholder="Documento de identidad"
                    aria-label="Documento"
                    disabled={busy}
                />
                {errors.document && (
                    <p className="text-sm text-danger">{errors.document.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Input
                    {...register("phone")}
                    type="tel"
                    placeholder="Teléfono"
                    aria-label="Teléfono"
                    disabled={busy}
                />
                {errors.phone && (
                    <p className="text-sm text-danger">{errors.phone.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Input
                    {...register("whatsapp")}
                    type="tel"
                    placeholder="WhatsApp (opcional)"
                    aria-label="WhatsApp"
                    disabled={busy}
                />
                {errors.whatsapp && (
                    <p className="text-sm text-danger">{errors.whatsapp.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Input
                    {...register("email")}
                    type="email"
                    placeholder="Correo electrónico"
                    aria-label="Email"
                    disabled={busy}
                />
                {errors.email && (
                    <p className="text-sm text-danger">{errors.email.message}</p>
                )}
            </div>

            <Button
                type="submit"
                variant="primary"
                isDisabled={busy}
            >
                <Save size={18} />
                {busy ? "Guardando..." : "Guardar vendedor"}
            </Button>
        </form>
    );
}
