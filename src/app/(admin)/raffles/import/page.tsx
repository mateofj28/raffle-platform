"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Button, Card, CardContent, toast } from "@heroui/react";
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/utils/formatters";
import { useRaffleStore } from "@/store/raffle.store";
import { callFunction } from "@/services/firebase-callable";

// Fila normalizada del Excel, lista para validar/enviar.
interface ParsedRow {
    row: number;              // número de fila en el Excel (1-based, sin cabecera)
    vendor: string;
    number: number | null;    // null si no se pudo interpretar
    customerName: string;
    customerDocument: string;
    customerPhone: string;
    deposit: number;          // total abonado (sumado)
    // Problemas detectados por fila.
    errors: string[];
    // Cliente con nombre pero sin cédula → requiere que el admin la complete.
    needsDocument: boolean;
}

interface ImportRowResult {
    row: number;
    number: number;
    status: "ok" | "error";
    vendorCreated?: boolean;
    customerCreated?: boolean;
    depositApplied?: number;
    changed?: boolean;
    message?: string;
}

interface ImportResponse {
    total: number;
    ok: number;
    errors: number;
    changed: number;
    unchanged: number;
    results: ImportRowResult[];
}

// Encabezados aceptados (flexibles con acentos/mayúsculas).
const HEADER_ALIASES: Record<string, keyof Omit<ParsedRow, "row" | "errors" | "needsDocument">> = {
    vendedor: "vendor",
    numero: "number",
    "número": "number",
    nombre_cliente: "customerName",
    "nombre cliente": "customerName",
    cliente: "customerName",
    cedula: "customerDocument",
    "cédula": "customerDocument",
    celular: "customerPhone",
    telefono: "customerPhone",
    "teléfono": "customerPhone",
    abono: "deposit",
};

function toInt(value: unknown): number {
    if (typeof value === "number") return Math.round(value);
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : 0;
}

export default function ImportRafflePage() {
    const { activeRaffle } = useRaffleStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fileName, setFileName] = useState("");
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [processing, setProcessing] = useState(false);
    const [summary, setSummary] = useState<ImportResponse | null>(null);

    // Recalcula errores/needsDocument de una fila (se usa al editar cédulas).
    const validateRow = (r: ParsedRow, seenNumbers: Map<number, number>): ParsedRow => {
        const errors: string[] = [];
        if (!r.vendor.trim()) errors.push("Falta el vendedor");
        if (r.number === null || Number.isNaN(r.number)) {
            errors.push("Número inválido");
        } else if (r.number < 0 || r.number > 9999) {
            errors.push("Número fuera de rango (0-9999)");
        } else {
            const firstRow = seenNumbers.get(r.number);
            if (firstRow !== undefined && firstRow !== r.row) {
                errors.push(`Número repetido (fila ${firstRow})`);
            }
        }
        const needsDocument = !!r.customerName.trim() && !r.customerDocument.trim();
        return { ...r, errors, needsDocument };
    };

    const revalidateAll = (list: ParsedRow[]): ParsedRow[] => {
        const seen = new Map<number, number>();
        for (const r of list) {
            if (r.number !== null && !seen.has(r.number)) seen.set(r.number, r.row);
        }
        return list.map((r) => validateRow(r, seen));
    };

    const handleFile = async (file: File) => {
        setSummary(null);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

            if (raw.length === 0) {
                toast.danger("El archivo no tiene filas de datos.");
                return;
            }

            // Mapear encabezados reales -> campos internos.
            const firstKeys = Object.keys(raw[0]);
            const keyMap: Record<string, keyof Omit<ParsedRow, "row" | "errors" | "needsDocument">> = {};
            for (const key of firstKeys) {
                const norm = key.trim().toLowerCase();
                const mapped = HEADER_ALIASES[norm];
                if (mapped) keyMap[key] = mapped;
            }

            const hasVendor = Object.values(keyMap).includes("vendor");
            const hasNumber = Object.values(keyMap).includes("number");
            if (!hasVendor || !hasNumber) {
                toast.danger("El Excel debe tener al menos las columnas 'vendedor' y 'numero'.");
                return;
            }

            const parsed: ParsedRow[] = raw.map((rec, idx) => {
                const base: ParsedRow = {
                    row: idx + 1,
                    vendor: "",
                    number: null,
                    customerName: "",
                    customerDocument: "",
                    customerPhone: "",
                    deposit: 0,
                    errors: [],
                    needsDocument: false,
                };
                for (const [origKey, field] of Object.entries(keyMap)) {
                    const val = rec[origKey];
                    if (field === "number") {
                        const n = toInt(val);
                        base.number = String(val ?? "").trim() === "" ? null : n;
                    } else if (field === "deposit") {
                        base.deposit = toInt(val);
                    } else {
                        (base[field] as string) = String(val ?? "").trim();
                    }
                }
                return base;
            });

            // Descartar filas totalmente vacías (sin vendedor y sin número).
            const nonEmpty = parsed.filter((r) => r.vendor.trim() || r.number !== null);
            setRows(revalidateAll(nonEmpty));
            setFileName(file.name);
        } catch (e) {
            console.error(e);
            toast.danger("No se pudo leer el archivo. Verifica que sea un Excel válido.");
        }
    };

    const updateDocument = (rowIdx: number, value: string) => {
        setRows((prev) => {
            const copy = prev.map((r) => (r.row === rowIdx ? { ...r, customerDocument: value } : r));
            return revalidateAll(copy);
        });
    };

    // Rellena con placeholder de cédula todas las filas que tengan cliente sin cédula.
    const fillPlaceholders = () => {
        setRows((prev) => {
            let seq = 0;
            const copy = prev.map((r) => {
                if (r.customerName.trim() && !r.customerDocument.trim()) {
                    seq += 1;
                    return { ...r, customerDocument: `SIN-CED-${String(r.row).padStart(4, "0")}` };
                }
                return r;
            });
            void seq;
            return revalidateAll(copy);
        });
        toast.success("Se asignaron cédulas temporales a los clientes sin cédula.");
    };

    const stats = useMemo(() => {
        const total = rows.length;
        const withErrors = rows.filter((r) => r.errors.length > 0).length;
        const needDoc = rows.filter((r) => r.needsDocument).length;
        const withDeposit = rows.filter((r) => r.deposit > 0).length;
        const totalDeposit = rows.reduce((s, r) => s + r.deposit, 0);
        return { total, withErrors, needDoc, withDeposit, totalDeposit };
    }, [rows]);

    const canImport = rows.length > 0 && stats.withErrors === 0 && stats.needDoc === 0 && !processing;

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ["vendedor", "numero", "nombre_cliente", "cedula", "celular", "abono"],
            ["Luz Estella Bedoya", 4687, "", "", "", 0],
            ["Luz Estella Bedoya", 4785, "Camilo Posada", "197381454704", "3001112233", 60000],
            ["Yolanda Contreras", 9735, "Carlos Arturo Lopez", "347228974", "3004445566", 60000],
        ]);
        ws["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 10 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Boletas");
        XLSX.writeFile(wb, "plantilla-importacion-rifa.xlsx");
    };

    const handleImport = async () => {
        if (!activeRaffle || !canImport) return;
        setProcessing(true);
        setSummary(null);
        try {
            const payload = {
                raffleId: activeRaffle.id,
                rows: rows.map((r) => ({
                    row: r.row,
                    vendor: r.vendor.trim(),
                    number: r.number as number,
                    customerName: r.customerName.trim(),
                    customerDocument: r.customerDocument.trim(),
                    customerPhone: r.customerPhone.trim(),
                    deposit: r.deposit,
                })),
            };
            const res = await callFunction<ImportResponse, typeof payload>("importRaffleData", payload);
            setSummary(res);
            if (res.errors > 0) {
                toast.danger(`Importación con ${res.errors} errores. Revisa el detalle.`);
            } else if (res.changed === 0) {
                toast.success("Todo ya estaba al día: no se registró nada nuevo.");
            } else {
                toast.success(`Importación completa: ${res.changed} filas aplicadas.`);
            }
        } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message : "No se pudo completar la importación.";
            toast.danger(msg);
        } finally {
            setProcessing(false);
        }
    };

    const reset = () => {
        setRows([]);
        setFileName("");
        setSummary(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (!activeRaffle) {
        return (
            <div>
                <PageHeader title="Importar datos" description="Selecciona primero una rifa." />
                <Link href="/raffles"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Ir a rifas</Button></Link>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Importar datos"
                description={`Carga masiva desde Excel — ${activeRaffle.name}`}
                actions={
                    <Link href="/raffles">
                        <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                    </Link>
                }
            />

            {/* Paso 1: subir archivo + plantilla */}
            <Card className="mb-5">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="font-semibold flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Paso 1: Sube tu archivo</h3>
                            <p className="text-sm text-default-500 mt-1">
                                Columnas: <span className="font-mono">vendedor, numero, nombre_cliente, cedula, celular, abono</span>.
                                El abono es el total ya sumado de la boleta.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onPress={downloadTemplate}>
                            <Download className="h-4 w-4" /> Descargar plantilla
                        </Button>
                    </div>

                    <div className="mt-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                        />
                        <Button variant="primary" onPress={() => fileInputRef.current?.click()}>
                            <Upload className="h-4 w-4" /> {fileName ? "Cambiar archivo" : "Elegir archivo Excel"}
                        </Button>
                        {fileName && <span className="ml-3 text-sm text-default-600">{fileName}</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Paso 2: vista previa */}
            {rows.length > 0 && (
                <Card className="mb-5">
                    <CardContent className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <h3 className="font-semibold">Paso 2: Revisa antes de importar</h3>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-default-100 px-3 py-1">{stats.total} filas</span>
                                <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1">{stats.withDeposit} con abono</span>
                                <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1">{formatCurrency(stats.totalDeposit)} en abonos</span>
                                {stats.withErrors > 0 && <span className="rounded-full bg-danger/10 text-danger px-3 py-1">{stats.withErrors} con errores</span>}
                                {stats.needDoc > 0 && <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1">{stats.needDoc} sin cédula</span>}
                            </div>
                        </div>

                        {stats.needDoc > 0 && (
                            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span>Hay {stats.needDoc} cliente(s) con nombre pero sin cédula. Complétala en la tabla, o asigna cédulas temporales.</span>
                                <Button variant="outline" size="sm" onPress={fillPlaceholders}>Usar cédulas temporales</Button>
                            </div>
                        )}

                        <div className="overflow-x-auto border border-default-200 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-default-50 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">#</th>
                                        <th className="px-3 py-2 font-medium">Vendedor</th>
                                        <th className="px-3 py-2 font-medium">Número</th>
                                        <th className="px-3 py-2 font-medium">Cliente</th>
                                        <th className="px-3 py-2 font-medium">Cédula</th>
                                        <th className="px-3 py-2 font-medium">Abono</th>
                                        <th className="px-3 py-2 font-medium">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const hasError = r.errors.length > 0;
                                        return (
                                            <tr key={r.row} className={`border-t border-default-100 ${hasError ? "bg-danger/5" : r.needsDocument ? "bg-amber-50" : ""}`}>
                                                <td className="px-3 py-2 text-default-400">{r.row}</td>
                                                <td className="px-3 py-2">{r.vendor || <span className="text-danger">—</span>}</td>
                                                <td className="px-3 py-2 font-mono">{r.number ?? <span className="text-danger">?</span>}</td>
                                                <td className="px-3 py-2">{r.customerName || <span className="text-default-400">Sin cliente</span>}</td>
                                                <td className="px-3 py-2">
                                                    {r.customerName ? (
                                                        <input
                                                            value={r.customerDocument}
                                                            onChange={(e) => updateDocument(r.row, e.target.value)}
                                                            placeholder="Ingresa cédula"
                                                            className={`w-32 rounded border px-2 py-1 text-sm outline-none ${r.needsDocument ? "border-amber-400 bg-amber-50" : "border-default-200 bg-default-50"}`}
                                                        />
                                                    ) : (
                                                        <span className="text-default-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 font-mono">{r.deposit > 0 ? formatCurrency(r.deposit) : <span className="text-default-400">$0</span>}</td>
                                                <td className="px-3 py-2">
                                                    {hasError ? (
                                                        <span className="text-danger text-xs flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {r.errors.join(", ")}</span>
                                                    ) : r.needsDocument ? (
                                                        <span className="text-amber-600 text-xs">Falta cédula</span>
                                                    ) : (
                                                        <span className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Lista</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-4">
                            <Button variant="primary" isDisabled={!canImport} onPress={handleImport}>
                                {processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : <><Upload className="h-4 w-4" /> Importar {stats.total} filas</>}
                            </Button>
                            <Button variant="ghost" size="sm" onPress={reset} isDisabled={processing}>Cancelar</Button>
                            {!canImport && stats.withErrors > 0 && (
                                <span className="text-sm text-danger">Corrige los errores antes de importar.</span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Paso 3: resumen */}
            {summary && (
                <Card>
                    <CardContent className="p-5">
                        <h3 className="font-semibold mb-3">Resultado de la importación</h3>
                        <div className="flex flex-wrap gap-3 mb-4 text-sm">
                            <span className="rounded-full bg-default-100 px-3 py-1">{summary.total} filas</span>
                            <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1">{summary.changed} aplicadas</span>
                            {summary.unchanged > 0 && <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1">{summary.unchanged} sin cambios (ya estaban)</span>}
                            {summary.errors > 0 && <span className="rounded-full bg-danger/10 text-danger px-3 py-1">{summary.errors} con error</span>}
                        </div>
                        {summary.errors === 0 && summary.changed === 0 && (
                            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                                Estas boletas ya estaban registradas con estos datos, así que no se registró nada nuevo. La importación es segura de repetir: no duplica abonos ni clientes.
                            </div>
                        )}
                        {summary.errors > 0 && (
                            <div className="overflow-x-auto border border-default-200 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-default-50 text-left">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Fila</th>
                                            <th className="px-3 py-2 font-medium">Número</th>
                                            <th className="px-3 py-2 font-medium">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.results.filter((x) => x.status === "error").map((x) => (
                                            <tr key={x.row} className="border-t border-default-100">
                                                <td className="px-3 py-2 text-default-400">{x.row}</td>
                                                <td className="px-3 py-2 font-mono">{x.number}</td>
                                                <td className="px-3 py-2 text-danger">{x.message}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="mt-4">
                            <Button variant="outline" size="sm" onPress={reset}>Importar otro archivo</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
