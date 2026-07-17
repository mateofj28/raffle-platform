"use client";

import { Input } from "@heroui/react";
import type { ComponentPropsWithRef } from "react";

interface FormFieldProps extends ComponentPropsWithRef<typeof Input> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Reusable form field component.
 * Wraps HeroUI Input with label, error message, and optional hint.
 * Follows Single Responsibility: only handles field presentation.
 */
export function FormField({ label, error, hint, ...inputProps }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {inputProps.required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <Input
        {...inputProps}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? `${label}-error` : undefined}
        className={`w-full ${error ? "[&_input]:border-danger" : ""} ${inputProps.className || ""}`}
      />
      {error && (
        <p id={`${label}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-default-400">{hint}</p>
      )}
    </div>
  );
}
