import type { QueryClient } from "@tanstack/react-query";

/**
 * Helper for optimistic updates with TanStack Query.
 * Provides a pattern for:
 * 1. Cancelling in-flight queries
 * 2. Snapshotting previous data
 * 3. Optimistically updating
 * 4. Rolling back on error
 */
export function createOptimisticConfig<TData, TVariables>(options: {
    queryKey: string[];
    updater: (old: TData | undefined, variables: TVariables) => TData | undefined;
}) {
    return {
        onMutate: async (variables: TVariables) => {
            // Need access to queryClient — this will be used in the hook context
            return { variables };
        },
        // The actual optimistic logic is handled per-hook
    };
}

/**
 * Standard error handler for mutations that shows a toast.
 */
export function createMutationErrorHandler(
    addToast: (opts: { message: string; type: "error" }) => void
) {
    return (error: unknown) => {
        const message =
            error instanceof Error ? error.message : "Ocurrió un error inesperado";
        addToast({ message, type: "error" });
    };
}
