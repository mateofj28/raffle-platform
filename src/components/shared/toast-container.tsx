"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
    const icons = {
        success: <CheckCircle className="h-5 w-5 text-success" />,
        error: <AlertCircle className="h-5 w-5 text-danger" />,
        info: <Info className="h-5 w-5 text-primary" />,
    };

    const bgColors = {
        success: "bg-success/10 border-success/20",
        error: "bg-danger/10 border-danger/20",
        info: "bg-primary/10 border-primary/20",
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-center gap-3 rounded-lg border p-3 shadow-lg ${bgColors[toast.type]}`}
                    >
                        {icons[toast.type]}
                        <p className="flex-1 text-sm">{toast.message}</p>
                        <button
                            onClick={() => onRemove(toast.id)}
                            className="text-default-400 hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
