import Link from "next/link";
import { Button } from "@heroui/react";
import { Plus, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function CustomersPage() {
    return (
        <div>
            <PageHeader
                title="Clientes"
                description="Administra la información de tus clientes"
                actions={
                    <Link href="/customers/new">
                        <Button variant="primary" size="sm"><Plus className="h-4 w-4" /> Nuevo Cliente</Button>
                    </Link>
                }
            />
            <EmptyState title="No hay clientes" description="Los clientes se crean al vender boletas" icon={<UserCircle className="h-12 w-12" />} />
        </div>
    );
}
