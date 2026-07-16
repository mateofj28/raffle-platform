import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function PaymentsPage() {
    return (
        <div>
            <PageHeader title="Pagos" description="Historial de pagos y abonos registrados" />
            <EmptyState title="No hay pagos" description="Los pagos se registran al cobrar boletas" icon={<CreditCard className="h-12 w-12" />} />
        </div>
    );
}
