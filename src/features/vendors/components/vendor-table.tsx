"use client";

import Link from "next/link";
import type { Vendor } from "@/types/api.types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Eye } from "lucide-react";

const VENDOR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: "Activo", color: "success" },
    inactive: { label: "Inactivo", color: "default" },
    suspended: { label: "Suspendido", color: "danger" },
};

/**
 * Deriva el usuario de login del vendedor a partir de su nombre, con la MISMA
 * lógica usada al crear el acceso ("Juan Pérez" → "jperez"; "Tomas" → "tomas").
 * Así el usuario mostrado coincide con el que usa para iniciar sesión.
 */
function usernameFromName(fullName: string): string {
    const clean = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}${parts[parts.length - 1]}`;
}

interface VendorTableProps {
    vendors: Vendor[];
}

export function VendorTable({ vendors }: VendorTableProps) {
    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-default-200">
                <table className="w-full text-sm">
                    <thead className="bg-default-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Nombre</th>
                            <th className="px-4 py-3 text-left font-medium">Usuario</th>
                            <th className="px-4 py-3 text-left font-medium">Documento</th>
                            <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                            <th className="px-4 py-3 text-left font-medium">Estado</th>
                            <th className="px-4 py-3 text-right font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-default-200">
                        {vendors.map((vendor) => (
                            <tr key={vendor.id} className="hover:bg-default-50">
                                <td className="px-4 py-3 font-medium">{vendor.name}</td>
                                <td className="px-4 py-3 font-mono text-default-600">{usernameFromName(vendor.name)}</td>
                                <td className="px-4 py-3 text-default-600">{vendor.document}</td>
                                <td className="px-4 py-3 text-default-600">{vendor.phone}</td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={vendor.status} statusConfig={VENDOR_STATUS_CONFIG} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Link href={`/vendors/${vendor.id}`} className="text-default-500 hover:text-primary">
                                        <Eye className="h-4 w-4 inline" />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
