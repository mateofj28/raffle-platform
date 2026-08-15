"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

interface FormErrorBannerProps {
  message: string | null;
}

/**
 * Displays a server-side or general form error.
 * Auto-scrolls into view and shakes to grab user attention.
 */
export function FormErrorBanner({ message }: FormErrorBannerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current.classList.remove("animate-shake");
      // Force reflow to restart animation
      void ref.current.offsetWidth;
      ref.current.classList.add("animate-shake");
    }
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={ref}
      className="flex items-start gap-3 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-shake"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}
