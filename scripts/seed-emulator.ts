/**
 * Seeds the Firebase Emulator with initial data.
 * Run this AFTER starting emulators: firebase emulators:start
 *
 * Usage:
 *   npx tsx scripts/seed-emulator.ts
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "raffle-platform-5c584" });
const auth = getAuth(app);
const db = getFirestore(app);

const TENANT_ID = "empresa-principal";
const ADMIN_EMAIL = "admin@rifas.com";
const ADMIN_PASSWORD = "Admin123!";

async function seed() {
  console.log("🚀 Seeding emulator...\n");

  // 1. Create tenant
  console.log("📁 Creating tenant...");
  await db.collection("tenants").doc(TENANT_ID).set({
    name: "Mi Empresa de Rifas",
    plan: "free",
    createdAt: FieldValue.serverTimestamp(),
    settings: {
      timezone: "America/Bogota",
      commissionRate: 0.30,
      currency: "COP",
    },
  });

  // 2. Create metrics
  console.log("📊 Creating metrics...");
  const metricsPath = `tenants/${TENANT_ID}/metrics`;
  await db.doc(`${metricsPath}/sales`).set({ dailySales: 0, monthlySales: 0, moneyCollected: 0, moneyPending: 0, lastUpdated: FieldValue.serverTimestamp() });
  await db.doc(`${metricsPath}/raffles`).set({ activeCount: 0, finishedCount: 0, ticketsSold: 0, ticketsAvailable: 0, ticketsCancelled: 0, lastUpdated: FieldValue.serverTimestamp() });
  await db.doc(`${metricsPath}/people`).set({ vendorsCount: 0, customersCount: 0, topVendors: [], topRaffles: [], topCustomers: [], lastUpdated: FieldValue.serverTimestamp() });
  await db.doc(`${metricsPath}/financial`).set({ commissionsPaid: 0, commissionsPending: 0, totalProfit: 0, profitByRaffle: [], dailyIncome: 0, monthlyIncome: 0, lastUpdated: FieldValue.serverTimestamp() });

  // 3. Create admin user
  console.log("👤 Creating admin user...");
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch {
    userRecord = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: "Administrador Principal",
    });
  }

  // 4. Set custom claims
  console.log("🔐 Setting custom claims...");
  await auth.setCustomUserClaims(userRecord.uid, {
    tenantId: TENANT_ID,
    role: "admin",
  });

  // 5. Store user in tenant
  await db.doc(`tenants/${TENANT_ID}/users/${userRecord.uid}`).set({
    email: ADMIN_EMAIL,
    displayName: "Administrador Principal",
    role: "admin",
    vendorId: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "seed-script",
    disabled: false,
  });

  console.log("\n═══════════════════════════════════════");
  console.log("✅ EMULATOR SEED COMPLETADO");
  console.log("═══════════════════════════════════════");
  console.log(`\n📋 Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("🌐 App: http://localhost:3000/login");
  console.log("🔥 Emulator UI: http://localhost:4000\n");
}

seed().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
