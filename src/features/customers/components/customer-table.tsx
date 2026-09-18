"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, AlertDialog, toast } from "@heroui/react";
import type { Customer } from "@/types/api.types";
import { Eye, Trash2 } from "lucide-react";
import { customerService } from "../services/customer.service";

interface CustomerTableProps {
  customers: Customer[];
  /** Solo el admin puede eliminar. */
  canDelete?: boolean;
  /** IDs de clientes con boletas pendientes (saldo > 0): no se pueden eliminar. */
  pendingIds?: Set<string>;
  /** Se llama tras eliminar para refrescar la lista. */
  onDeleted?: () => void;
}

export function CustomerTable({ customers, canDelete = false, pendingIds, onDeleted }: CustomerTableProps) {
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await customerService.remove(toDelete.id);
      toast.success(`Cliente "${toDelete.name}" eliminado`);
      setToDelete(null);
      onDeleted?.();
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : "No se pudo eliminar el cliente");
    } finally {
      setDeleting(false);
    }
  };

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
                <div className="inline-flex items-center gap-3">
                  <Link href={`/customers/${customer.id}`} className="text-default-500 hover:text-primary" aria-label="Ver cliente">
                    <Eye className="h-4 w-4 inline" />
                  </Link>
                  {canDelete && !pendingIds?.has(customer.id) && (
                    <button
                      onClick={() => setToDelete(customer)}
                      className="text-default-400 hover:text-red-500 transition-colors"
                      aria-label="Eliminar cliente"
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

      {/* Modal de confirmación de eliminación */}
      <AlertDialog.Backdrop isOpen={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }} isDismissable>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Eliminar cliente?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Vas a eliminar a <strong>{toDelete?.name}</strong> ({toDelete?.document}). Esta acción no se puede deshacer.</p>
              <p className="text-sm text-default-500 mt-2">Si el cliente tiene boletas asociadas, no se podrá eliminar.</p>
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
    </div>
  );
}
