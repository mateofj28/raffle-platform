"use client";

import Link from "next/link";
import type { Raffle } from "@/types/api.types";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatCurrency } from "@/utils/formatters";
import { Eye, Pencil } from "lucide-react";

interface RaffleTableProps {
    raffles: Raffle[];
}

export function RaffleTable({ raffles }: RaffleTableProps) {
    return (
        <div className="overflow-x-auto rounded-lg border border-default-200">
            <table className="w-full text-sm">
                <thead className="bg-default-100">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Nombre</th>
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-left font-medium">Premio</th>
                        <th className="px-4 py-3 text-right font-medium">Boletas</th>
                        <th className="px-4 py-3 text-right font-medium">Precio</th>
                        <th className="px-4 py-3 text-left font-medium">Sorteo</th>
                        <th className="px-4 py-3 text-right font-medium">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                    {raffles.map((raffle) => (
                        <tr key={raffle.id} className="hover:bg-default-50">
                            <td className="px-4 py-3 font-medium">{raffle.name}</td>
                            <td className="px-4 py-3"><StatusBadge status={raffle.status} /></td>
                            <td className="px-4 py-3 text-default-600">{raffle.prize}</td>
                            <td className="px-4 py-3 text-right">{raffle.totalTickets.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(raffle.ticketPrice)}</td>
                            <td className="px-4 py-3">{formatDate(raffle.drawDate)}</td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Link href={`/raffles/${raffle.id}`} className="text-default-500 hover:text-primary">
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                    <Link href={`/raffles/${raffle.id}/edit`} className="text-default-500 hover:text-primary">
                                        <Pencil className="h-4 w-4" />
                                    </Link>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
