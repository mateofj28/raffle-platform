import { PageHeader } from "@/components/shared/page-header";
import { Shield } from "lucide-react";

export default function AuditPage() {
    return (
        <div>
            <PageHeader title="Auditoría" description="Registro de todas las operaciones críticas" />
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-default-300 mb-4" />
                <p className="text-default-500">El registro de auditoría se conectará a datos en tiempo real</p>
            </div>
        </div>
    );
}
