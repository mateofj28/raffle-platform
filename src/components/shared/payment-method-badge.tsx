"use client";

const METHOD_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    cash: { label: "Efectivo", bg: "bg-emerald-100", text: "text-emerald-700" },
    nequi: { label: "Nequi", bg: "bg-[#E6F2ED]", text: "text-[#200020]" },
    daviplata: { label: "Daviplata", bg: "bg-[#FFF0E6]", text: "text-[#ED1C24]" },
    card: { label: "Tarjeta", bg: "bg-blue-100", text: "text-blue-700" },
    transfer: { label: "Transferencia", bg: "bg-violet-100", text: "text-violet-700" },
    other: { label: "Otro", bg: "bg-default-100", text: "text-default-600" },
};

interface PaymentMethodBadgeProps {
    method: string;
}

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
    const config = METHOD_CONFIG[method] || METHOD_CONFIG.other;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
}
