"use client";

import { Input as HeroInput } from "@heroui/react";
import type { ComponentPropsWithRef } from "react";

// Forces gray background on HeroUI Input by overriding the CSS variable
// and applying inline style (which has highest CSS priority)
export function Input({ style, className, ...props }: ComponentPropsWithRef<typeof HeroInput>) {
    return (
        <HeroInput
            {...props}
            className={`[background-color:#E2E8F0] ${className ?? ""}`}
            style={{
                backgroundColor: "#E2E8F0",
                borderColor: "#CBD5E1",
                ...style,
            }}
        />
    );
}
