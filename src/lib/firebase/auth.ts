import {
    getAuth,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User,
    type Auth,
} from "firebase/auth";
import { getFirebaseApp } from "./config";

let _auth: Auth | null = null;

function getAuthInstance(): Auth {
    if (_auth) return _auth;
    _auth = getAuth(getFirebaseApp());
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
