"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";

interface ConnectivityWarningProps {
    status: "connected" | "disconnected" | "error";
}

export function ConnectivityWarning({ status }: ConnectivityWarningProps) {
    const isDisconnected = status === "disconnected" || status === "error";

    return (
        <AnimatePresence>
            {isDisconnected && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-warning/90 text-warning-foreground py-2 px-4 text-sm"
                >
                    <WifiOff className="h-4 w-4" />
                    <span>Conexión perdida. Intentando reconectar...</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
