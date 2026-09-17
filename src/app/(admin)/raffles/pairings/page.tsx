"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, toast } from "@heroui/react";
import { ArrowLeft, Plus, Trash2, Check, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { formatTicketNumber } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { pairingService, type NumberPair } from "@/features/raffles/services/pairing.service";

const TOTAL_NUMBERS = 10000;
const EXPECTED_PAIRS = TOTAL_NUMBERS / 2; // 5000

export default function PairingsPage() {
    const router = useRouter();
    const userRole = useAuthStore((s) => s.user?.role);

    const [loading, setLoading] = useState(true);
    const [pairs, setPairs] = useState<NumberPair[]>([]);
    const [a, setA] = useState("");
    const [b, setB] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [bulk, setBulk] = useState("");
    const [alreadySaved, setAlreadySaved] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Solo admin.
    useEffect(() => {
        if (userRole && userRole !== "admin") router.replace("/raffles");
    }, [userRole, router]);

    // Cargar parejas existentes (si ya se definieron).
    useEffect(() => {
        (async () => {
            try {
                const res = await pairingService.get();
                if (res.pairs && res.pairs.length > 0) {
                    setPairs(res.pairs);
                    setAlreadySaved(true);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, []);

    // Conjunto de números ya usados (para validar duplicados en O(1)).
    const usedNumbers = useMemo(() => {
        const s = new Set<number>();
        pairs.forEach(([x, y]) => { s.add(x); s.add(y); });
        return s;
    }, [pairs]);

    const numbersCovered = usedNumbers.size;
    const complete = pairs.length === EXPECTED_PAIRS && numbersCovered === TOTAL_NUMBERS;

    const addPair = () => {
        setError(null);
        const na = parseInt(a);
        const nb = parseInt(b);
        if (Number.isNaN(na) || na < 0 || na > 9999) { setError("El primer número debe estar entre 0000 y 9999."); return; }
        if (Number.isNaN(nb) || nb < 0 || nb > 9999) { setError("El segundo número debe estar entre 0000 y 9999."); return; }
        if (na === nb) { setError("Los dos números de una pareja deben ser distintos."); return; }
        if (usedNumbers.has(na)) { setError(`El número ${formatTicketNumber(na)} ya está en otra pareja.`); return; }
        if (usedNumbers.has(nb)) { setError(`El número ${formatTicketNumber(nb)} ya está en otra pareja.`); return; }
        if (pairs.length >= EXPECTED_PAIRS) { setError(`Ya están las ${EXPECTED_PAIRS} parejas.`); return; }
        setPairs((prev) => [...prev, [na, nb]]);
        setA(""); setB("");
    };

    const removePair = (index: number) => setPairs((prev) => prev.filter((_, i) => i !== index));

    /**
     * Valida y agrega una lista de parejas candidatas a las actuales.
     * `label` describe el origen (línea/fila) para mensajes de error claros.
     * Devuelve true si se agregaron; false si hubo error (ya lo dejó en setError).
     */
    const mergePairs = (
        candidates: { pair: [number, number]; label: string }[]
    ): boolean => {
        const next: NumberPair[] = [...pairs];
        const seen = new Set<number>(usedNumbers);
        for (const { pair, label } of candidates) {
            const [x, y] = pair;
            if ([x, y].some((n) => Number.isNaN(n) || n < 0 || n > 9999)) {
                setError(`Valor inválido en ${label}. Los números deben estar entre 0000 y 9999.`);
                return false;
            }
            if (x === y) { setError(`Pareja inválida (números iguales) en ${label}.`); return false; }
            if (seen.has(x)) { setError(`El número ${formatTicketNumber(x)} está repetido (${label}).`); return false; }
            if (seen.has(y)) { setError(`El número ${formatTicketNumber(y)} está repetido (${label}).`); return false; }
            seen.add(x); seen.add(y);
            next.push([x, y]);
        }
        if (next.length > EXPECTED_PAIRS) { setError(`Se superan las ${EXPECTED_PAIRS} parejas.`); return false; }
        setPairs(next);
        return true;
    };

    // Carga masiva: pegar líneas "a,b" o "a b" (una pareja por línea).
    const importBulk = () => {
        setError(null);
        const lines = bulk.split(/\n/).map((l) => l.trim()).filter(Boolean);
        const candidates = lines.map((line) => {
            const parts = line.split(/[\s,;]+/).map((p) => parseInt(p.replace(/\D/g, "")));
            return { pair: [parts[0], parts[1]] as [number, number], label: `"${line}"` };
        });
        if (mergePairs(candidates)) setBulk("");
    };

    // Importar desde Excel (.xlsx/.xls) o CSV: dos columnas = los dos números.
    // Se ignora una fila de encabezado si la primera fila no es numérica.
    const handleExcelFile = async (file: File) => {
        setError(null);
        setImporting(true);
        try {
            const XLSX = await import("xlsx");
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            if (!sheet) { setError("El archivo no tiene hojas."); return; }
            // Matriz de filas; cada fila es un arreglo de celdas.
            const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, blankrows: false });

            const candidates: { pair: [number, number]; label: string }[] = [];
            rows.forEach((row, idx) => {
                if (!row || row.length < 2) return; // fila vacía o incompleta: se ignora
                const x = parseInt(String(row[0]).replace(/\D/g, ""));
                const y = parseInt(String(row[1]).replace(/\D/g, ""));
                // Salta encabezados u otras filas no numéricas.
                if (Number.isNaN(x) || Number.isNaN(y)) return;
                candidates.push({ pair: [x, y], label: `fila ${idx + 1}` });
            });

            if (candidates.length === 0) {
                setError("No se encontraron parejas válidas en el archivo. Debe tener dos columnas con los números.");
                return;
            }
            if (mergePairs(candidates)) {
                toast.success(`${candidates.length} pareja(s) importada(s) del archivo`);
            }
        } catch (e) {
            console.error(e);
            setError("No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) o CSV válido.");
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const save = async () => {
        setError(null);
        if (!complete) { setError(`Faltan parejas: van ${pairs.length} de ${EXPECTED_PAIRS} (números cubiertos ${numbersCovered}/${TOTAL_NUMBERS}).`); return; }
        setSaving(true);
        try {
            await pairingService.save(pairs);
            toast.success("Parejas guardadas");
            setAlreadySaved(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudieron guardar las parejas");
        } finally { setSaving(false); }
    };

    if (loading) return <div><PageHeader title="Parejas de números" /><LoadingSkeleton rows={6} /></div>;

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader
                title="Parejas de números"
                description="Define las 5.000 parejas (0000–9999) para las rifas de 2 números. Se definen una sola vez y se reutilizan."
                actions={
                    <Button variant="ghost" size="sm" onPress={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" /> Volver
                    </Button>
                }
            />

            {alreadySaved && (
                <div className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" /> Ya hay parejas guardadas. Puedes ajustarlas y volver a guardar.
                </div>
            )}

            <FormErrorBanner message={error} />

            {/* Progreso */}
            <Card className="mb-4">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Progreso</span>
                        <span className="text-sm text-default-500">{pairs.length}/{EXPECTED_PAIRS} parejas — {numbersCovered}/{TOTAL_NUMBERS} números</span>
                    </div>
                    <div className="w-full h-2 bg-default-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all" style={{ width: `${Math.min((numbersCovered / TOTAL_NUMBERS) * 100, 100)}%` }} />
                    </div>
                </CardContent>
            </Card>

            {/* Agregar una pareja */}
            <Card className="mb-4">
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Agregar pareja</h3>
                    <div className="flex items-end gap-3 flex-wrap">
                        <div>
                            <label className="text-xs font-medium mb-1 block">Número 1</label>
                            <Input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPair(); } }} placeholder="Ej: 1282" inputMode="numeric" className="w-28" maxLength={4} />
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Número 2</label>
                            <Input value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPair(); } }} placeholder="Ej: 8888" inputMode="numeric" className="w-28" maxLength={4} />
                        </div>
                        <Button variant="outline" size="sm" onPress={addPair} isDisabled={!a || !b}><Plus className="h-4 w-4" /> Agregar</Button>
                    </div>

                    {/* Importar desde Excel (opcional) */}
                    <div className="mt-4 rounded-lg border border-dashed border-default-300 p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium">Importar desde Excel</span>
                        </div>
                        <p className="text-xs text-default-500 mb-3">
                            Sube un archivo <span className="font-mono">.xlsx</span>, <span className="font-mono">.xls</span> o <span className="font-mono">.csv</span> con dos columnas:
                            el primer número y el segundo número de cada pareja (una pareja por fila). Si la primera fila es un encabezado, se ignora.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelFile(f); }}
                        />
                        <Button variant="outline" size="sm" isDisabled={importing} onPress={() => fileInputRef.current?.click()}>
                            <FileSpreadsheet className="h-4 w-4" /> {importing ? "Leyendo archivo..." : "Elegir archivo Excel"}
                        </Button>
                    </div>

                    {/* Carga masiva por texto (opcional) */}
                    <div className="mt-4">
                        <label className="text-xs font-medium mb-1 block">Pegar lista (opcional) — una pareja por línea, formato "1282,8888"</label>
                        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={4} placeholder={"1282,8888\n1211,8811\n..."} className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary font-mono" />
                        <div className="mt-2"><Button variant="ghost" size="sm" onPress={importBulk} isDisabled={!bulk.trim()}>Importar pegado</Button></div>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de parejas */}
            <Card className="mb-4">
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Parejas definidas ({pairs.length})</h3>
                    {pairs.length === 0 ? (
                        <p className="text-sm text-default-500">Aún no hay parejas. Agrégalas arriba.</p>
                    ) : (
                        <div className="max-h-80 overflow-y-auto flex flex-wrap gap-2">
                            {pairs.map(([x, y], i) => (
                                <div key={i} className="group flex items-center gap-2 px-2.5 py-1 rounded-md border border-default-200 text-xs font-mono">
                                    <span>{formatTicketNumber(x)} · {formatTicketNumber(y)}</span>
                                    <button onClick={() => removePair(i)} className="text-default-300 group-hover:text-red-500 transition-colors" aria-label="Quitar pareja">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3 pb-6">
                <Button variant="primary" isDisabled={saving || !complete} onPress={save}>
                    {saving ? "Guardando..." : "Guardar parejas"}
                </Button>
            </div>
        </div>
    );
}
