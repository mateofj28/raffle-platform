"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Separator, Checkbox, toast } from "@heroui/react";
import { Save, Building2, Percent, DollarSign, CreditCard, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatCurrency } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings.store";
import { settingsService } from "@/features/settings/services/settings.service";
import type { ActivePaymentMethod } from "@/types/api.types";

const PAYMENT_METHOD_OPTIONS: { value: ActivePaymentMethod; label: string }[] = [
    { value: "cash", label: "Efectivo" },
    { value: "nequi", label: "Nequi" },
    { value: "daviplata", label: "Daviplata" },
    { value: "transfer", label: "Bancolombia" },
];

export default function SettingsPage() {
    const settings = useSettingsStore((s) => s.settings);
    const setSettings = useSettingsStore((s) => s.setSettings);

    // Estado local del formulario (se inicializa desde el store)
    const [businessName, setBusinessName] = useState("");
    const [businessNit, setBusinessNit] = useState("");
    const [businessPhone, setBusinessPhone] = useState("");
    const [commissionPct, setCommissionPct] = useState("30"); // se maneja como % entero
    const [minInstallment, setMinInstallment] = useState("5000");
    const [defaultTicketPrice, setDefaultTicketPrice] = useState("60000");
    const [activeMethods, setActiveMethods] = useState<ActivePaymentMethod[]>([]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hidratar el formulario con los settings actuales
    useEffect(() => {
        setBusinessName(settings.businessInfo.name || "");
        setBusinessNit(settings.businessInfo.nit || "");
        setBusinessPhone(settings.businessInfo.phone || "");
        setCommissionPct(String(Math.round(settings.commissionRate * 100)));
        setMinInstallment(String(settings.minInstallment));
        setDefaultTicketPrice(String(settings.defaultTicketPrice));
        setActiveMethods(settings.activePaymentMethods);
    }, [settings]);

    const toggleMethod = (method: ActivePaymentMethod) => {
        setActiveMethods((prev) =>
            prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
        );
    };

    const handleSave = async () => {
        setError(null);

        const pct = parseInt(commissionPct || "0", 10);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            setError("La comisión debe estar entre 0% y 100%.");
            return;
        }
        const min = parseInt(minInstallment || "0", 10);
        if (isNaN(min) || min <= 0) {
            setError("El monto mínimo de abono debe ser mayor a 0.");
            return;
        }
        const price = parseInt(defaultTicketPrice || "0", 10);
        if (isNaN(price) || price <= 0) {
            setError("El precio de boleta por defecto debe ser mayor a 0.");
            return;
        }
        if (activeMethods.length === 0) {
            setError("Debe haber al menos un método de pago activo.");
            return;
        }

        setSaving(true);
        try {
            const updated = await settingsService.updateSettings({
                commissionRate: pct / 100,
                minInstallment: min,
                defaultTicketPrice: price,
                activePaymentMethods: activeMethods,
                businessInfo: {
                    name: businessName.trim(),
                    nit: businessNit.trim(),
                    phone: businessPhone.trim(),
                },
            });
            setSettings(updated);
            toast.success("Configuración guardada");
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar la configuración");
        } finally {
            setSaving(false);
        }
    };

    const companyPct = 100 - (parseInt(commissionPct || "0", 10) || 0);

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader
                title="Configuración"
                description="Ajustes de la plataforma"
                actions={
                    <Button variant="primary" size="sm" isDisabled={saving} onPress={handleSave}>
                        <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                }
            />

            <FormErrorBanner message={error} />

            <div className="space-y-6">
                {/* Datos del negocio */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Datos del negocio
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Nombre</label>
                                <Input placeholder="Ej: Rifas La Suerte" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">NIT / Identificación</label>
                                <Input placeholder="Ej: 900123456-7" value={businessNit} onChange={(e) => setBusinessNit(e.target.value)} className="w-full" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Teléfono</label>
                                <Input placeholder="Ej: 3001234567" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} className="w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Parámetros financieros */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Percent className="h-4 w-4 text-amber-500" /> Comisión y montos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Comisión del vendedor (%)</label>
                                <Input placeholder="30" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" maxLength={3} className="w-full" />
                                <p className="text-xs text-default-500 mt-1">La empresa recibe el {companyPct}% restante.</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Monto mínimo de abono</label>
                                <Input placeholder="5000" value={minInstallment ? parseInt(minInstallment).toLocaleString("es-CO") : ""} onChange={(e) => setMinInstallment(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full" />
                                <p className="text-xs text-default-500 mt-1">{minInstallment ? formatCurrency(parseInt(minInstallment)) : "—"}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> Precio boleta por defecto</label>
                                <Input placeholder="60000" value={defaultTicketPrice ? parseInt(defaultTicketPrice).toLocaleString("es-CO") : ""} onChange={(e) => setDefaultTicketPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full" />
                                <p className="text-xs text-default-500 mt-1">{defaultTicketPrice ? formatCurrency(parseInt(defaultTicketPrice)) : "—"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Métodos de pago */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-emerald-500" /> Métodos de pago activos
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {PAYMENT_METHOD_OPTIONS.map((m) => (
                                <Checkbox key={m.value} isSelected={activeMethods.includes(m.value)} onChange={() => toggleMethod(m.value)}>
                                    {m.label}
                                </Checkbox>
                            ))}
                        </div>
                        <p className="text-xs text-default-500 mt-3">Los métodos desactivados no aparecerán al registrar pagos.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
