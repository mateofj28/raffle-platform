/**
 * Impresión del listado de boletas de un vendedor.
 *
 * Abre una ventana nueva con un documento HTML limpio (encabezado con vendedor,
 * rifa, fecha y totales, más la tabla Números/Estado/Cliente/Abonado/Saldo) y
 * dispara el diálogo de impresión del navegador. Desde ahí el usuario puede
 * imprimir en papel o guardar como PDF.
 */

import { formatCurrency } from "./formatters";

export interface PrintTicketRow {
    /** Texto de los números (ej. "0055" o "0055 · 1234" en parejas). */
    numbers: string;
    /** Número base para ordenar. */
    sortNumber: number;
    /** Estado visible: Disponible/Asignada/Abonada/Vendida. */
    status: string;
    /** Nombre del cliente o "Sin cliente". */
    customer: string;
    /** Monto abonado. */
    paid: number;
    /** Saldo pendiente. */
    pending: number;
}

export interface PrintTicketsReport {
    vendorName: string;
    raffleLabel: string;   // ej. "Las dos primas del año — 2do semestre 2027"
    totals: { label: string; value: string }[]; // Total abonado, Recaudado, Comisión...
    rows: PrintTicketRow[];
}

// Escapa texto para insertarlo en HTML sin romper el markup.
function esc(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function printTicketsReport(report: PrintTicketsReport): void {
    const rows = [...report.rows].sort((a, b) => a.sortNumber - b.sortNumber);

    const now = new Date();
    const fecha = now.toLocaleString("es-CO", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const totalsHtml = report.totals
        .map((t) => `<div class="total"><span class="total-label">${esc(t.label)}</span><span class="total-value">${esc(t.value)}</span></div>`)
        .join("");

    const rowsHtml = rows
        .map((r) => `
            <tr>
                <td class="mono">${esc(r.numbers)}</td>
                <td>${esc(r.status)}</td>
                <td>${esc(r.customer)}</td>
                <td class="right mono">${esc(formatCurrency(r.paid))}</td>
                <td class="right mono">${esc(formatCurrency(r.pending))}</td>
            </tr>`)
        .join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Boletas - ${esc(report.vendorName)}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1f2937; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .sub { color: #6b7280; font-size: 13px; margin: 0; }
    .meta { color: #6b7280; font-size: 12px; margin: 2px 0 16px; }
    .totals { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
    .total { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; min-width: 150px; }
    .total-label { display: block; font-size: 11px; color: #6b7280; }
    .total-value { display: block; font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    .right { text-align: right; }
    .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .count { color: #6b7280; font-size: 12px; margin: 10px 0 0; }
    @media print {
        body { margin: 10mm; }
        th { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>
</head>
<body>
    <h1>${esc(report.vendorName)}</h1>
    <p class="sub">${esc(report.raffleLabel)}</p>
    <p class="meta">Impreso el ${esc(fecha)}</p>

    <div class="totals">${totalsHtml}</div>

    <table>
        <thead>
            <tr>
                <th>Números</th>
                <th>Estado</th>
                <th>Cliente</th>
                <th class="right">Abonado</th>
                <th class="right">Saldo</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>
    <p class="count">${rows.length} boleta(s)</p>

    <script>
        window.onload = function () {
            window.focus();
            window.print();
            // Cerrar tras imprimir/cancelar (en navegadores que lo permiten).
            window.onafterprint = function () { window.close(); };
        };
    </script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
        // Si el navegador bloquea la ventana emergente.
        alert("Permite las ventanas emergentes para imprimir.");
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
}
