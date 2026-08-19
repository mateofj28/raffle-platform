/**
 * Seeds 20 payments with varied methods, types, and amounts.
 * Run AFTER emulators are running and a raffle + tickets exist.
 *
 * Usage: npx tsx scripts/seed-payments.ts
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const app = initializeApp({ projectId: "raffle-platform-5c584" });
const db = getFirestore(app);

const TENANT_ID = "empresa-principal";

async function seed() {
    console.log("🔍 Buscando rifa 'Las dos primas del año'...\n");

    // Find the raffle
    const rafflesSnap = await db.collection(`tenants/${TENANT_ID}/raffles`).get();
    const raffle = rafflesSnap.docs.find(d => d.data().name.includes("primas"));

    if (!raffle) {
        console.error("❌ No se encontró la rifa 'Las dos primas del año'");
        console.log("Rifas disponibles:", rafflesSnap.docs.map(d => d.data().name));
        process.exit(1);
    }

    const raffleId = raffle.id;
    const ticketPrice = raffle.data().ticketPrice;
    console.log(`✅ Rifa encontrada: ${raffle.data().name} (ID: ${raffleId}, precio: $${ticketPrice})`);

    // Get vendors
    const vendorsSnap = await db.collection(`tenants/${TENANT_ID}/vendors`).get();
    const vendors = vendorsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
    console.log(`👥 Vendedores: ${vendors.length}`);

    // Get customers
    const customersSnap = await db.collection(`tenants/${TENANT_ID}/customers`).get();
    const customers = customersSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
    console.log(`👤 Clientes: ${customers.length}`);

    // Get assigned/sold tickets
    let ticketsSnap = await db.collection(`tenants/${TENANT_ID}/raffles/${raffleId}/tickets`)
        .where("status", "in", ["assigned", "sold", "installment"])
        .limit(25)
        .get();

    let tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    console.log(`🎫 Boletas asignadas/vendidas: ${tickets.length}`);

    // If not enough, assign available tickets first
    if (tickets.length < 20) {
        console.log(`\n📌 Asignando boletas disponibles...`);
        const availableSnap = await db.collection(`tenants/${TENANT_ID}/raffles/${raffleId}/tickets`)
            .where("status", "==", "available")
            .limit(20 - tickets.length)
            .get();

        const vendorToUse = vendors.length > 0 ? vendors[0].id : null;
        const customerToUse = customers.length > 0 ? customers[0].id : null;

        for (const ticketDoc of availableSnap.docs) {
            await ticketDoc.ref.update({
                status: "sold",
                vendorId: vendorToUse || vendors[availableSnap.docs.indexOf(ticketDoc) % Math.max(1, vendors.length)]?.id || null,
                customerId: customerToUse,
                saleDate: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
        console.log(`  ✅ ${availableSnap.size} boletas asignadas y vendidas`);

        // Re-fetch
        ticketsSnap = await db.collection(`tenants/${TENANT_ID}/raffles/${raffleId}/tickets`)
            .where("status", "in", ["assigned", "sold", "installment"])
            .limit(25)
            .get();
        tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        console.log(`🎫 Boletas ahora disponibles para pago: ${tickets.length}`);
    }

    if (tickets.length < 20) {
        console.error(`❌ Aún no hay suficientes boletas (${tickets.length}). Crea más en la rifa.`);
        process.exit(1);
    }

    const methods = ["cash", "nequi", "daviplata", "card", "transfer"] as const;
    const observations = [
        "Pago en oficina",
        "Transferencia verificada",
        "Pago recibido por vendedor",
        "Abono parcial - queda pendiente",
        "Pago completo al momento",
        "Cliente pagó por Nequi",
        "Recibido en efectivo",
        "Pago con tarjeta en local",
        "",
        "Verificado",
    ];

    // Define 20 payments with variety
    const paymentConfigs = [
        { type: "payment", method: "cash", amountRatio: 1 },
        { type: "payment", method: "nequi", amountRatio: 1 },
        { type: "payment", method: "daviplata", amountRatio: 1 },
        { type: "payment", method: "card", amountRatio: 1 },
        { type: "payment", method: "transfer", amountRatio: 1 },
        { type: "installment", method: "cash", amountRatio: 0.5 },
        { type: "installment", method: "nequi", amountRatio: 0.3 },
        { type: "installment", method: "daviplata", amountRatio: 0.4 },
        { type: "installment", method: "cash", amountRatio: 0.6 },
        { type: "installment", method: "card", amountRatio: 0.25 },
        { type: "payment", method: "cash", amountRatio: 1 },
        { type: "payment", method: "nequi", amountRatio: 1 },
        { type: "installment", method: "transfer", amountRatio: 0.5 },
        { type: "installment", method: "cash", amountRatio: 0.35 },
        { type: "payment", method: "daviplata", amountRatio: 1 },
        { type: "installment", method: "nequi", amountRatio: 0.7 },
        { type: "payment", method: "card", amountRatio: 1 },
        { type: "installment", method: "cash", amountRatio: 0.45 },
        { type: "payment", method: "transfer", amountRatio: 1 },
        { type: "installment", method: "daviplata", amountRatio: 0.55 },
    ];

    console.log("💳 Registrando 20 pagos...\n");

    for (let i = 0; i < 20; i++) {
        const ticket = tickets[i];
        const config = paymentConfigs[i];
        const amount = config.amountRatio === 1
            ? ticket.pendingBalance
            : Math.max(5000, Math.floor(ticket.pendingBalance * config.amountRatio));

        const vendorId = ticket.vendorId || (vendors.length > 0 ? vendors[i % vendors.length].id : null);
        const customerId = ticket.customerId || (customers.length > 0 ? customers[i % customers.length].id : null);

        const ticketDocId = ticket.id;
        const paymentRef = db.collection(`tenants/${TENANT_ID}/payments`).doc();

        // Create payment
        await paymentRef.set({
            ticketId: ticketDocId,
            raffleId,
            customerId: customerId || null,
            vendorId: vendorId || null,
            amount,
            type: config.type,
            method: config.method,
            date: FieldValue.serverTimestamp(),
            observations: observations[i % observations.length],
            createdAt: FieldValue.serverTimestamp(),
            createdBy: "seed-script",
        });

        // Update ticket
        const newPendingBalance = ticket.pendingBalance - amount;
        let newStatus: string;
        if (newPendingBalance <= 0) {
            newStatus = "paid";
        } else {
            newStatus = "installment";
        }

        // If ticket was "assigned" and has no customer, also set it as sold
        const updates: any = {
            status: newStatus,
            pendingBalance: Math.max(0, newPendingBalance),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (ticket.status === "assigned" && customerId) {
            updates.customerId = customerId;
            updates.saleDate = FieldValue.serverTimestamp();
        }

        await db.doc(`tenants/${TENANT_ID}/raffles/${raffleId}/tickets/${ticketDocId}`).update(updates);

        const statusLabel = newStatus === "paid" ? "✅ PAGADA" : "⏳ ABONO";
        console.log(`  ${i + 1}. Boleta #${ticketDocId} — $${amount.toLocaleString()} (${config.method}) ${statusLabel}`);
    }

    console.log("\n═══════════════════════════════════════");
    console.log("✅ 20 PAGOS REGISTRADOS EXITOSAMENTE");
    console.log("═══════════════════════════════════════\n");
}

seed().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
