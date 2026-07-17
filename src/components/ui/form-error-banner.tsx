"use client";

import { AlertCircle } from "lucide-react";

interface FormErrorBannerProps {
  message: string | null;
}

/**
 * Displays a server-side or general form error.
 * Single Responsibility: only handles error display at form level.
 */
export function FormErrorBanner({ message }: FormErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}
