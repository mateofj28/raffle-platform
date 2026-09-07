"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, CardContent, toast } from "@heroui/react";
import type { Vendor } from "@/types/api.types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Eye, KeyRound, Copy } from "lucide-react";
import { callFunction } from "@/services/firebase-callable";
import { vendorService } from "../services/vendor.service";

const VENDOR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: "Activo", color: "success" },
    inactive: { label: "Inactivo", color: "default" },
    suspended: { label: "Suspendido", color: "danger" },
};

/** "Juan Pérez" → "jperez"; "Tomas" → "tomas" */
function generateUsername(fullName: string): string {
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
    const queryClient = useQueryClient();
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null);

    const handleGenerateAccess = async (vendor: Vendor) => {
        const document = (vendor.document || "").trim();
        if (document.length < 6) {
            toast.danger("La cédula del vendedor debe tener al menos 6 dígitos para generar el acceso.");
            return;
        }
        const username = generateUsername(vendor.name);
        const email = `${username}@rifas.app`;
        const password = document;

        setGeneratingId(vendor.id);
        try {
            const res = await callFunction<{ uid: string }>("createUser", {
                email,
                password,
                displayName: vendor.name,
                role: "vendor",
                vendorId: vendor.id,
            });
            // Guardar el uid en el vendor para marcar que ya tiene acceso.
            await vendorService.update(vendor.id, { userId: res.uid });
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
            setCredentials({ name: vendor.name, username, password });
            toast.success(`Acceso generado para ${vendor.name}`);
        } catch (e) {
            toast.danger(e instanceof Error ? e.message : "No se pudo generar el acceso");
        } finally {
            setGeneratingId(null);
        }
    };

    return (
        <>
            {/* Credenciales recién generadas */}
            {credentials && (
                <Card className="mb-4 border-2 border-success/30">
                    <CardContent className="p-4">
                        <p className="text-sm font-semibold text-success mb-2">✅ Acceso creado para {credentials.name} — comparte estas credenciales:</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-default-500">Usuario</p>
                                <p className="font-mono font-bold text-lg">{credentials.username}</p>
                            </div>
                            <div>
                                <p className="text-xs text-default-500">Contraseña</p>
                                <p className="font-mono font-bold text-lg">{credentials.password}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onPress={async () => {
                                    try {
                                        await navigator.clipboard.writeText(`Usuario: ${credentials.username}\nContraseña: ${credentials.password}`);
                                        toast.success("Credenciales copiadas");
                                    } catch {
                                        toast.danger("No se pudieron copiar");
                                    }
                                }}
                            >
                                <Copy className="h-4 w-4" /> Copiar credenciales
                            </Button>
                            <Button variant="danger" size="sm" onPress={() => setCredentials(null)}>
                                Cerrar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="overflow-x-auto rounded-lg border border-default-200">
                <table className="w-full text-sm">
                    <thead className="bg-default-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Nombre</th>
                            <th className="px-4 py-3 text-left font-medium">Documento</th>
                            <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                            <th className="px-4 py-3 text-left font-medium">Estado</th>
                            <th className="px-4 py-3 text-left font-medium">Acceso</th>
                            <th className="px-4 py-3 text-right font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-default-200">
                        {vendors.map((vendor) => (
                            <tr key={vendor.id} className="hover:bg-default-50">
                                <td className="px-4 py-3 font-medium">{vendor.name}</td>
                                <td className="px-4 py-3 text-default-600">{vendor.document}</td>
                                <td className="px-4 py-3 text-default-600">{vendor.phone}</td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={vendor.status} statusConfig={VENDOR_STATUS_CONFIG} />
                                </td>
                                <td className="px-4 py-3">
                                    {vendor.userId ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                                            <KeyRound className="h-3.5 w-3.5" /> Con acceso
                                        </span>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            isDisabled={generatingId === vendor.id}
                                            onPress={() => handleGenerateAccess(vendor)}
                                        >
                                            <KeyRound className="h-4 w-4" />
                                            {generatingId === vendor.id ? "Generando..." : "Generar acceso"}
                                        </Button>
                                    )}
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
