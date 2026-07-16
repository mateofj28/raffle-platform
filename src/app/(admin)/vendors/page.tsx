import Link from "next/link";
import { Button } from "@heroui/react";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function VendorsPage() {
    return (
        <div>
            <PageHeader
                title="Vendedores"
                description="Gestiona tus vendedores y sus comisiones"
                actions={
                    <Link href="/vendors/new">
                        <Button variant="primary" size="sm"><Plus className="h-4 w-4" /> Nuevo Vendedor</Button>
                    </Link>
                }
            />
            <EmptyState title="No hay vendedores" description="Agrega tu primer vendedor" icon={<Users className="h-12 w-12" />} />
        </div>
    );
}
