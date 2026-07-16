import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Ticket } from "lucide-react";

export default function VendorTicketsPage() {
    return (
        <div>
            <PageHeader title="Mis Boletas" description="Boletas asignadas a ti" />
            <EmptyState
                title="No tienes boletas asignadas"
                description="Contacta al administrador para que te asigne boletas"
                icon={<Ticket className="h-12 w-12" />}
            />
        </div>
    );
}
