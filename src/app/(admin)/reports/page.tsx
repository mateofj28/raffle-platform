import { PageHeader } from "@/components/shared/page-header";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
    return (
        <div>
            <PageHeader title="Reportes" description="Genera reportes y exportaciones de datos" />
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-default-300 mb-4" />
                <p className="text-default-500">Selecciona un tipo de reporte para generar</p>
            </div>
        </div>
    );
}
