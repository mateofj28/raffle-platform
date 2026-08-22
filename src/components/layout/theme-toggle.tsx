"use client";

import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggle = () => {
        const html = document.documentElement;
        if (html.classList.contains("dark")) {
            html.classList.remove("dark");
            setIsDark(false);
            localStorage.setItem("theme", "light");
        } else {
            html.classList.add("dark");
            setIsDark(true);
            localStorage.setItem("theme", "dark");
      }
    };

    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Cambiar tema"
        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        {isDark ? <Sun className="h-5 w-5 text-[#A0B4C8]" /> : <Moon className="h-5 w-5 text-[#A0B4C8]" />}
      </button>
    );
}
