import { getFunctions, httpsCallable, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/config";

let _functions: Functions | null = null;
let _emulatorConnected = false;

function getFunctionsInstance(): Functions {
    if (_functions) return _functions;
    _functions = getFunctions(getFirebaseApp());

    // Connect to emulator in development
    if (process.env.NODE_ENV === "development" && !_emulatorConnected && typeof window !== "undefined") {
        connectFunctionsEmulator(_functions, "localhost", 5001);
        _emulatorConnected = true;
    }

    return _functions;
}

/**
 * Generic wrapper for calling Firebase Cloud Functions.
 */
export async function callFunction<TResponse, TRequest = unknown>(
    name: string,
    data?: TRequest
): Promise<TResponse> {
    const callable = httpsCallable<TRequest, TResponse>(getFunctionsInstance(), name);
    const result = await callable(data as TRequest);
    return result.data;
}
