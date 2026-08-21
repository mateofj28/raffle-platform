/**
 * Creates a user account for an existing vendor.
 * Usage: npx tsx scripts/create-vendor-user.ts
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "raffle-platform-5c584" });
const auth = getAuth(app);
const db = getFirestore(app);

const TENANT_ID = "empresa-principal";

async function run() {
    // Get all vendors
    const vendorsSnap = await db.collection(`tenants/${TENANT_ID}/vendors`).get();
    const vendors = vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    console.log("\n📋 Vendedores disponibles:");
    vendors.forEach((v, i) => console.log(`  ${i + 1}. ${v.name} (${v.document})`));

    // Create user for the first vendor
    const vendor = vendors[0];
    if (!vendor) {
        console.error("No hay vendedores");
        process.exit(1);
    }

    console.log(`\n🔧 Creando usuario para: ${vendor.name}`);

    // Generate username from name
    const clean = vendor.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const username = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1]}` : parts[0];
    const email = `${username}@rifas.app`;
    const password = vendor.document; // cédula como contraseña

    console.log(`  Email interno: ${email}`);
    console.log(`  Usuario: ${username}`);
    console.log(`  Contraseña: ${password}`);

    // Create auth user
    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(email);
        console.log("  ⚠️  Usuario ya existía");
    } catch {
        userRecord = await auth.createUser({
            email,
            password,
            displayName: vendor.name,
        });
        console.log("  ✅ Usuario creado en Auth");
    }

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
        tenantId: TENANT_ID,
        role: "vendor",
        vendorId: vendor.id,
    });
    console.log("  ✅ Claims asignados (role: vendor)");

    // Store in tenant users collection
    await db.doc(`tenants/${TENANT_ID}/users/${userRecord.uid}`).set({
        email,
        displayName: vendor.name,
        role: "vendor",
        vendorId: vendor.id,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "script",
        disabled: false,
    });
    console.log("  ✅ Documento de usuario creado");

    // Update vendor with userId
    await db.doc(`tenants/${TENANT_ID}/vendors/${vendor.id}`).update({
        userId: userRecord.uid,
    });

    console.log("\n═══════════════════════════════════════");
    console.log("✅ VENDEDOR LISTO PARA INICIAR SESIÓN");
    console.log("═══════════════════════════════════════");
    console.log(`\n  Usuario: ${username}`);
    console.log(`  Contraseña: ${password}`);
    console.log(`\n  URL: http://localhost:3000/login\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
