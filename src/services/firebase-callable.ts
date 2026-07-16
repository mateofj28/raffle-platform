import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/config";

let _functions: Functions | null = null;

function getFunctionsInstance(): Functions {
    if (_functions) return _functions;
    _functions = getFunctions(getFirebaseApp());
    return _functions;
}

/**
 * Generic wrapper for calling Firebase Cloud Functions.
 * Provides typed request/response handling.
 */
export async function callFunction<TResponse, TRequest = unknown>(
    name: string,
    data?: TRequest
): Promise<TResponse> {
    const callable = httpsCallable<TRequest, TResponse>(getFunctionsInstance(), name);
    const result = await callable(data as TRequest);
    return result.data;
}
