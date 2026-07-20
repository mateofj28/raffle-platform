"use client";

import { Sun, Moon } from "lucide-react";
import { Button } from "@heroui/react";
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
        <Button
            variant="ghost"
            size="sm"
            isIconOnly
          onPress={toggle}
          aria-label="Cambiar tema"
      >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
  );
}
