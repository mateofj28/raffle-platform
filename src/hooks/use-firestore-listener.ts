"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    onSnapshot,
    query,
    collection,
    type QueryConstraint,
    type DocumentData,
} from "@/lib/firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";

type ConnectionStatus = "connected" | "disconnected" | "error";

interface UseFirestoreListenerOptions {
    collectionPath: string;
    queryConstraints?: QueryConstraint[];
    queryKey: string[];
    enabled?: boolean;
}

export function useFirestoreListener<T = DocumentData>({
    collectionPath,
    queryConstraints = [],
    queryKey,
    enabled = true,
}: UseFirestoreListenerOptions) {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<ConnectionStatus>("disconnected");

    useEffect(() => {
        if (!enabled) {
            setStatus("disconnected");
            return;
        }

        const collectionRef = collection(getDb(), collectionPath);
        const q =
            queryConstraints.length > 0
                ? query(collectionRef, ...queryConstraints)
                : query(collectionRef);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                setStatus("connected");
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as T[];
                queryClient.setQueryData(queryKey, data);
            },
            (error) => {
                console.error("Firestore listener error:", error);
                setStatus("error");
            }
        );

        return () => {
            unsubscribe();
            setStatus("disconnected");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionPath, enabled, JSON.stringify(queryKey)]);

    return { status };
}
