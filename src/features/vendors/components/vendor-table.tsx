"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, AlertDialog, toast } from "@heroui/react";
import type { Vendor } from "@/types/api.types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Eye, Trash2 } from "lucide-react";
import { vendorService } from "../services/vendor.service";

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
    /** Solo el admin puede eliminar. */
    canDelete?: boolean;
    /** IDs de vendedores con boletas pendientes (no cerradas): no se pueden eliminar. */
    pendingIds?: Set<string>;
    /** Se llama tras eliminar para refrescar la lista. */
    onDeleted?: () => void;
}

export function VendorTable({ vendors, canDelete = false, pendingIds, onDeleted }: VendorTableProps) {
    const [toDelete, setToDelete] = useState<Vendor | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await vendorService.remove(toDelete.id);
            toast.success(`Vendedor "${toDelete.name}" eliminado`);
            setToDelete(null);
            onDeleted?.();
        } catch (e) {
            toast.danger(e instanceof Error ? e.message : "No se pudo eliminar el vendedor");
        } finally {
            setDeleting(false);
        }
    };

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
                                    <div className="inline-flex items-center gap-3">
                                        <Link href={`/vendors/${vendor.id}`} className="text-default-500 hover:text-primary" aria-label="Ver vendedor">
                                            <Eye className="h-4 w-4 inline" />
                                        </Link>
                                        {canDelete && !pendingIds?.has(vendor.id) && (
                                            <button
                                                onClick={() => setToDelete(vendor)}
                                                className="text-default-400 hover:text-red-500 transition-colors"
                                                aria-label="Eliminar vendedor"
                                            >
                                                <Trash2 className="h-4 w-4 inline" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de confirmación de eliminación */}
            <AlertDialog.Backdrop isOpen={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }} isDismissable>
                <AlertDialog.Container placement="center" size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>¿Eliminar vendedor?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>Vas a eliminar a <strong>{toDelete?.name}</strong> ({toDelete?.document}). Esta acción no se puede deshacer.</p>
                            <p className="text-sm text-default-500 mt-2">Si el vendedor tiene boletas asignadas, no se podrá eliminar.</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cancelar</Button>
                            <Button variant="danger" isDisabled={deleting} onPress={handleDelete}>
                                {deleting ? "Eliminando..." : "Sí, eliminar"}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </>
    );
}
