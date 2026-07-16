"use client";

import { Menu, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@heroui/react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ThemeToggle } from "./theme-toggle";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
    onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
    const { user, logout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-divider bg-content1 px-4 md:px-6">
            {/* Mobile menu button */}
            <Button
                variant="ghost"
                size="sm"
                onPress={onMenuToggle}
                className="md:hidden"
                aria-label="Abrir menú"
                isIconOnly
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Title */}
            <h1 className="text-lg font-semibold hidden md:block">
                Raffle Platform
            </h1>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User dropdown - custom implementation to avoid nested buttons */}
            <div className="relative" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-default-100 transition-colors"
                >
                    {user?.displayName || user?.email || "Usuario"}
                    <ChevronDown className="h-4 w-4" />
                </button>

                {menuOpen && (
                    <div className="absolute right-0 mt-1 w-48 rounded-lg border border-divider bg-content1 shadow-lg py-1 z-50">
                        <button
                            type="button"
                            onClick={() => {
                                setMenuOpen(false);
                                logout();
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-default-600 hover:bg-default-100 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Cerrar sesión
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
