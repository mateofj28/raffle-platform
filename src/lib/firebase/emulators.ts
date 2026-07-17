"use client";

import { connectAuthEmulator, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, type Functions } from "firebase/functions";
import { connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

let emulatorsConnected = false;

/**
 * Connects Firebase services to local emulators.
 * Only runs in development and only once.
 */
export function connectEmulators(services: {
  auth?: Auth;
  firestore?: Firestore;
  functions?: Functions;
  storage?: FirebaseStorage;
}) {
  if (emulatorsConnected) return;
  if (process.env.NODE_ENV !== "development") return;
  if (typeof window === "undefined") return;

  const { auth, firestore, functions, storage } = services;

  if (auth) {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  }
  if (firestore) {
    connectFirestoreEmulator(firestore, "localhost", 8080);
  }
  if (functions) {
    connectFunctionsEmulator(functions, "localhost", 5001);
  }
  if (storage) {
    connectStorageEmulator(storage, "localhost", 9199);
  }

  emulatorsConnected = true;
  console.log("🔥 Firebase Emulators connected");
}
