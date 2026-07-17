"use client";

import Link from "next/link";
import type { Customer } from "@/types/api.types";
import { Eye } from "lucide-react";

interface CustomerTableProps {
  customers: Customer[];
}

export function CustomerTable({ customers }: CustomerTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-default-200">
      <table className="w-full text-sm">
        <thead className="bg-default-100">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Nombre</th>
            <th className="px-4 py-3 text-left font-medium">Documento</th>
            <th className="px-4 py-3 text-left font-medium">Teléfono</th>
            <th className="px-4 py-3 text-left font-medium">Ciudad</th>
            <th className="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-default-200">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-default-50">
              <td className="px-4 py-3 font-medium">{customer.name}</td>
              <td className="px-4 py-3 text-default-600">{customer.document}</td>
              <td className="px-4 py-3 text-default-600">{customer.phone}</td>
              <td className="px-4 py-3 text-default-600">{customer.city || "—"}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/customers/${customer.id}`} className="text-default-500 hover:text-primary">
                  <Eye className="h-4 w-4 inline" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
