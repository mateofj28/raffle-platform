import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreditCard } from "lucide-react";

export default function VendorPaymentsPage() {
    return (
        <div>
            <PageHeader title="Pagos" description="Registra pagos y abonos de tus boletas" />
            <EmptyState
                title="No hay pagos registrados"
                description="Registra un pago cuando un cliente realice un abono"
                icon={<CreditCard className="h-12 w-12" />}
            />
        </div>
    );
}
