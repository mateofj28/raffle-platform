"use client";

import { useState } from "react";
import { Button, Card, CardContent, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { UserPlus, User, Hash, Phone, MapPin, CheckCircle, ChevronDown } from "lucide-react";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { useAuthStore } from "@/store/auth.store";
import { callFunction } from "@/services/firebase-callable";
import { toast } from "@heroui/react";
import { DEPARTMENT_LIST, getCitiesByDepartment } from "@/constants/colombia-locations";

export default function VendorCreateCustomerPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [name, setName] = useState("");
    const [document, setDocument] = useState("");
    const [phone, setPhone] = useState("");
    const [department, setDepartment] = useState("");
    const [city, setCity] = useState("");
    const [address, setAddress] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState(false);

    const cities = department ? getCitiesByDepartment(department) : [];

    function capitalizeWords(text: string): string {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    const handleCreate = async () => {
        if (!name.trim() || !document.trim() || !phone.trim()) {
            setError("Nombre, cédula y teléfono son obligatorios");
            return;
        }
        if (document.trim().length < 6) {
            setError("La cédula debe tener al menos 6 dígitos");
            return;
        }
        setCreating(true);
        setError(null);
        try {
            await callFunction("createCustomer", {
                name: name.trim(),
                document: document.trim(),
                phone: phone.trim(),
                whatsapp: phone.trim(),
                address: address.trim(),
                city: city || "",
                department: department || "",
            });
            setCreated(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al crear cliente");
        } finally {
            setCreating(false);
        }
    };

    const handleReset = () => {
        setName(""); setDocument(""); setPhone("");
        setDepartment(""); setCity(""); setAddress("");
        setCreated(false); setError(null);
    };

    if (created) {
        return (
            <div className="max-w-md mx-auto mt-12">
                <Card>
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">¡Cliente creado!</h2>
                        <p className="text-sm text-default-500 mb-1">{name}</p>
                        <p className="text-xs text-default-400 mb-6">CC {document} · Tel {phone}</p>
                        <Button variant="primary" onPress={handleReset} className="w-full">
                            <UserPlus className="h-4 w-4" /> Crear otro cliente
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto mt-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Left panel */}
                <div className="md:w-56 shrink-0 flex flex-col items-center md:items-start md:sticky md:top-24">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#4A8C82" }}>
                        <UserPlus className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-center md:text-left">Nuevo cliente</h1>
                    <p className="text-sm text-default-500 mt-1 text-center md:text-left">Registra los datos del comprador de la boleta</p>
                </div>

                {/* Right: Form */}
                <Card className="flex-1 w-full">
                    <CardContent className="p-6">
                        <FormErrorBanner message={error} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 mt-2">
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <User className="h-4 w-4 text-default-400" /> Nombre completo
                                </label>
                                <Input placeholder="Ej: Juan Camilo Ríos" value={name} onChange={(e) => setName(capitalizeWords(e.target.value))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <Hash className="h-4 w-4 text-default-400" /> Cédula
                                </label>
                                <Input placeholder="1004445566" value={document} onChange={(e) => setDocument(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} className="w-full" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-default-400" /> Teléfono
                                </label>
                                <Input placeholder="3001234567" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} className="w-full" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-default-400" /> Departamento
                                </label>
                                <Select aria-label="Departamento" selectedKey={department || null} onSelectionChange={(key) => { setDepartment(String(key ?? "")); setCity(""); }} placeholder="Seleccionar" className="w-full">
                                    <SelectTrigger className="w-full"><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                    <SelectPopover><ListBox>{DEPARTMENT_LIST.map(d => (<ListBoxItem key={d} id={d} textValue={d}>{d}</ListBoxItem>))}</ListBox></SelectPopover>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-default-400" /> Ciudad
                                </label>
                                <Select aria-label="Ciudad" selectedKey={city || null} onSelectionChange={(key) => setCity(String(key ?? ""))} placeholder={department ? "Seleccionar" : "Elige depto."} isDisabled={!department} className="w-full">
                                    <SelectTrigger className="w-full"><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                    <SelectPopover><ListBox>{cities.map(c => (<ListBoxItem key={c} id={c} textValue={c}>{c}</ListBoxItem>))}</ListBox></SelectPopover>
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-default-400" /> Dirección <span className="text-xs text-default-400 font-normal">(opcional)</span>
                                </label>
                                <Input placeholder="Calle 123 #45-67, Barrio Centro" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full" />
                            </div>
                        </div>
                        <div className="mt-6">
                            <Button variant="primary" isDisabled={creating || !name.trim() || !document.trim() || !phone.trim()} onPress={handleCreate} className="w-full">
                                <UserPlus className="h-4 w-4" />
                                {creating ? "Creando..." : "Registrar cliente"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
