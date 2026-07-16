"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Eye } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES } from "@/constants/routes";
import type { Vendor } from "../types/vendor.types";

const VENDOR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: "Activo", color: "success" },
    inactive: { label: "Inactivo", color: "default" },
    suspended: { label: "Suspendido", color: "danger" },
};

interface VendorTableProps {
    vendors: Vendor[];
    isLoading?: boolean;
}

export function VendorTable({ vendors, isLoading }: VendorTableProps) {
    if (isLoading) {
        return (
            <div className="animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-default-100 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-default-200">
                        <th className="text-left py-3 px-4 font-medium text-default-600">Nombre</th>
                        <th className="text-left py-3 px-4 font-medium text-default-600">Documento</th>
                        <th className="text-left py-3 px-4 font-medium text-default-600">Teléfono</th>
                        <th className="text-left py-3 px-4 font-medium text-default-600">Estado</th>
                        <th className="text-right py-3 px-4 font-medium text-default-600">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {vendors.map((vendor) => (
                        <tr
                            key={vendor.id}
                            className="border-b border-default-100 hover:bg-default-50 transition-colors"
                        >
                            <td className="py-3 px-4 font-medium">{vendor.name}</td>
                            <td className="py-3 px-4 text-default-600">{vendor.document}</td>
                            <td className="py-3 px-4 text-default-600">{vendor.phone}</td>
                            <td className="py-3 px-4">
                                <StatusBadge
                                    status={vendor.status}
                                    statusConfig={VENDOR_STATUS_CONFIG}
                                />
                            </td>
                            <td className="py-3 px-4 text-right">
                                <Link href={ROUTES.ADMIN_VENDOR_DETAIL(vendor.id)}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        isIconOnly
                                        aria-label="Ver detalle"
                                    >
                                        <Eye size={16} />
                                    </Button>
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
