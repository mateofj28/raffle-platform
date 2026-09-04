"use client";

const METHOD_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    cash: { label: "Efectivo", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
    nequi: { label: "Nequi", bg: "bg-[#E6D6F5] dark:bg-[#4A0E78]/30", text: "text-[#6A0DAD] dark:text-[#C77DFF]" },
    daviplata: { label: "Daviplata", bg: "bg-[#FFE5E5] dark:bg-[#8B0000]/30", text: "text-[#E3001B] dark:text-[#FF6B6B]" },
    transfer: { label: "Bancolombia", bg: "bg-[#FFF4D6] dark:bg-[#6B5900]/30", text: "text-[#FDDA24] dark:text-[#FDDA24]" },
    // Fallback para datos antiguos con métodos ya descontinuados.
    other: { label: "Otro", bg: "bg-gray-100 dark:bg-gray-700/40", text: "text-gray-600 dark:text-gray-300" },
};

interface PaymentMethodBadgeProps {
    method: string;
}

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
    const config = METHOD_CONFIG[method] || METHOD_CONFIG.other;

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
}
