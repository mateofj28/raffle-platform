/**
 * Seed script: Creates the first tenant and admin user.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Prerequisites:
 *   1. Download your Firebase service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save it as `scripts/service-account.json` (gitignored)
 *   3. Ensure Authentication (Email/Password) and Firestore are enabled in Firebase Console
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// --- Configuration ---
const ADMIN_EMAIL = "admin@rifas.com";
const ADMIN_PASSWORD = "Admin123!";
const ADMIN_DISPLAY_NAME = "Administrador Principal";
const TENANT_ID = "empresa-principal";
const TENANT_NAME = "Mi Empresa de Rifas";

// --- Initialize Firebase Admin ---
const serviceAccountPath = resolve(process.cwd(), "scripts/service-account.json");

let serviceAccount: object;
try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
} catch {
    console.error("❌ No se encontró scripts/service-account.json");
    console.error("   Descárgalo desde: Firebase Console → Project Settings → Service Accounts → Generate new private key");
    process.exit(1);
}

const app = initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
});

const auth = getAuth(app);
const db = getFirestore(app);

async function seed() {
    console.log("🚀 Iniciando seed...\n");

    // 1. Create tenant document
    console.log(`📁 Creando tenant: ${TENANT_NAME}...`);
    const tenantRef = db.collection("tenants").doc(TENANT_ID);
    await tenantRef.set({
        name: TENANT_NAME,
        plan: "free",
        createdAt: FieldValue.serverTimestamp(),
        settings: {
            timezone: "America/Bogota",
            commissionRate: 0.30,
            currency: "COP",
        },
    });
    console.log(`   ✅ Tenant creado: ${TENANT_ID}\n`);

    // 2. Create initial metrics documents (zero values)
    console.log("📊 Creando documentos de métricas...");
    const metricsPath = `tenants/${TENANT_ID}/metrics`;

    await db.doc(`${metricsPath}/sales`).set({
        dailySales: 0,
        monthlySales: 0,
        moneyCollected: 0,
        moneyPending: 0,
        lastUpdated: FieldValue.serverTimestamp(),
    });

    await db.doc(`${metricsPath}/raffles`).set({
        activeCount: 0,
        finishedCount: 0,
        ticketsSold: 0,
        ticketsAvailable: 0,
        ticketsCancelled: 0,
        lastUpdated: FieldValue.serverTimestamp(),
    });

    await db.doc(`${metricsPath}/people`).set({
        vendorsCount: 0,
        customersCount: 0,
        topVendors: [],
        topRaffles: [],
        topCustomers: [],
        lastUpdated: FieldValue.serverTimestamp(),
    });

    await db.doc(`${metricsPath}/financial`).set({
        commissionsPaid: 0,
        commissionsPending: 0,
        totalProfit: 0,
        profitByRaffle: [],
        dailyIncome: 0,
        monthlyIncome: 0,
        lastUpdated: FieldValue.serverTimestamp(),
    });
    console.log("   ✅ Métricas inicializadas\n");

    // 3. Create admin user in Firebase Auth
    console.log(`👤 Creando usuario admin: ${ADMIN_EMAIL}...`);

    let userRecord;
    try {
        // Check if user already exists
        userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
        console.log(`   ⚠️  Usuario ya existe (uid: ${userRecord.uid})`);
    } catch {
        // Create new user
        userRecord = await auth.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            displayName: ADMIN_DISPLAY_NAME,
        });
        console.log(`   ✅ Usuario creado (uid: ${userRecord.uid})`);
    }

    // 4. Set custom claims
    console.log("🔐 Asignando custom claims (tenantId + role)...");
    await auth.setCustomUserClaims(userRecord.uid, {
        tenantId: TENANT_ID,
        role: "admin",
    });
    console.log("   ✅ Claims asignados: { tenantId: '" + TENANT_ID + "', role: 'admin' }\n");

    // 5. Store user record in tenant
    console.log("💾 Guardando usuario en Firestore...");
    await db.doc(`tenants/${TENANT_ID}/users/${userRecord.uid}`).set({
        email: ADMIN_EMAIL,
        displayName: ADMIN_DISPLAY_NAME,
        role: "admin",
        vendorId: null,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "seed-script",
        disabled: false,
    });
    console.log("   ✅ Usuario guardado en tenant\n");

    // --- Summary ---
    console.log("═══════════════════════════════════════════");
    console.log("✅ SEED COMPLETADO EXITOSAMENTE");
    console.log("═══════════════════════════════════════════");
    console.log("");
    console.log("📋 Credenciales de acceso:");
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log("");
    console.log("📋 Datos del tenant:");
    console.log(`   Tenant ID: ${TENANT_ID}`);
    console.log(`   Nombre:    ${TENANT_NAME}`);
    console.log("");
    console.log("🔗 Siguiente paso:");
    console.log("   Ejecuta: npm run dev");
    console.log("   Navega a: http://localhost:3000/login");
    console.log("   Ingresa con las credenciales de arriba");
    console.log("");
}

seed().catch((error) => {
    console.error("❌ Error durante el seed:", error);
    process.exit(1);
});
