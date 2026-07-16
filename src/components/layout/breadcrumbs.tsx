"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    raffles: "Rifas",
    vendors: "Vendedores",
    customers: "Clientes",
    payments: "Pagos",
    reports: "Reportes",
    audit: "Auditoría",
    settings: "Configuración",
    new: "Nuevo",
    edit: "Editar",
    tickets: "Boletas",
};

export function Breadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) return null;

    const breadcrumbs = segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const label = SEGMENT_LABELS[segment] || segment;
        const isLast = index === segments.length - 1;

        return { href, label, isLast };
    });

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-default-500">
            {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3 w-3" />}
                    {crumb.isLast ? (
                        <span className="text-foreground font-medium">
                            {crumb.label}
                        </span>
                    ) : (
                        <Link
                            href={crumb.href}
                            className="hover:text-foreground transition-colors"
                        >
                            {crumb.label}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
