"use client";

import { Input as HeroInput } from "@heroui/react";
import { useEffect, useState, type ComponentPropsWithRef } from "react";

export function Input({ style, ...props }: ComponentPropsWithRef<typeof HeroInput>) {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    const inputStyle: React.CSSProperties = isDark
        ? { backgroundColor: "#1A2F50", borderColor: "#2A4570", color: "#E2E8F0" }
        : { backgroundColor: "#FFFFFF", borderColor: "#E0E0E0", color: "#1F2937" };

    return (
        <HeroInput
            {...props}
            style={{ ...inputStyle, ...style }}
        />
    );
}
