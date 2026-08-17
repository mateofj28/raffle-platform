"use client";

import { Chip } from "@heroui/react";

const METHOD_CONFIG: Record<string, { label: string; color: "default" | "success" | "danger" | "warning" | "accent" }> = {
    cash: { label: "Efectivo", color: "success" },
    nequi: { label: "Nequi", color: "accent" },
    daviplata: { label: "Daviplata", color: "warning" },
    card: { label: "Tarjeta", color: "accent" },
    transfer: { label: "Transferencia", color: "accent" },
    other: { label: "Otro", color: "default" },
};

interface PaymentMethodBadgeProps {
    method: string;
}

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
    const config = METHOD_CONFIG[method] || METHOD_CONFIG.other;

    return (
        <Chip size="sm" color={config.color} variant="soft" className="px-3 py-1">
            {config.label}
        </Chip>
    );
}
