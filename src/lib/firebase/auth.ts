import {
    getAuth,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    connectAuthEmulator,
    reauthenticateWithCredential,
    EmailAuthProvider,
    type User,
    type Auth,
} from "firebase/auth";
import { getFirebaseApp } from "./config";

let _auth: Auth | null = null;
let _emulatorConnected = false;

function getAuthInstance(): Auth {
    if (_auth) return _auth;
    _auth = getAuth(getFirebaseApp());

    // Connect to emulator in development
    if (process.env.NODE_ENV === "development" && !_emulatorConnected && typeof window !== "undefined") {
        connectAuthEmulator(_auth, "http://localhost:9099", { disableWarnings: true });
        _emulatorConnected = true;
    }

    return _auth;
}

export async function signIn(email: string, password: string) {
    return signInWithEmailAndPassword(getAuthInstance(), email, password);
}

export async function signOut() {
    return firebaseSignOut(getAuthInstance());
}

export function onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(getAuthInstance(), callback);
}

export async function getIdTokenResult(user: User) {
    return user.getIdTokenResult(true);
}

/** Devuelve el usuario de Firebase actualmente autenticado (o null). */
export function getCurrentUser(): User | null {
    return getAuthInstance().currentUser;
}

/**
 * Reautentica al usuario actual con su contraseña. Se usa como prueba de
 * identidad antes de operaciones sensibles (cambiar correo o contraseña).
 * Lanza si la contraseña es incorrecta o no hay sesión.
 */
export async function reauthenticate(currentPassword: string) {
    const user = getAuthInstance().currentUser;
    if (!user || !user.email) {
        throw new Error("No hay una sesión activa.");
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    return reauthenticateWithCredential(user, credential);
}
