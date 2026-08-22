"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ROLES } from "@/constants/roles";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { LayoutDashboard, Ticket, CreditCard, LogOut, UserPlus } from "lucide-react";
import { Button } from "@heroui/react";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const VENDOR_NAV = [
    { href: "/vendor/dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { href: "/vendor/tickets", label: "Mis Boletas", icon: Ticket },
    { href: "/vendor/payments", label: "Pagos", icon: CreditCard },
    { href: "/vendor/customers/new", label: "Crear Cliente", icon: UserPlus },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    return (
        <AuthGuard requiredRole={ROLES.VENDOR}>
            <div className="min-h-dvh flex flex-col">
                <header className="sticky top-0 z-30 flex h-14 items-center px-4 border-b" style={{ backgroundColor: isDark ? "#001838" : "#FFFFFF", borderColor: isDark ? "transparent" : "#E8E8E8" }}>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-[#1F2937]"}`}>Raffle Platform</span>
                    <nav className="flex-1 flex items-center justify-center gap-1">
                        {VENDOR_NAV.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                        isActive
                                            ? (isDark ? "text-white bg-[#4A8C82]" : "text-[#2D6A5F] bg-[#D4E8E4]")
                                            : (isDark ? "text-[#A0B4C8] hover:bg-white/10 hover:text-white" : "text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#4A8C82]")
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                    <ThemeToggle />
                    <span className={`text-sm hidden md:inline ${isDark ? "text-[#A0B4C8]" : "text-[#6B7280]"}`}>{user?.displayName || user?.email}</span>
                    <button
                        type="button"
                        onClick={() => logout()}
                        aria-label="Cerrar sesión"
                        className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-[#F3F4F6]"}`}
                    >
                        <LogOut className={`h-4 w-4 ${isDark ? "text-[#A0B4C8]" : "text-[#6B7280]"}`} />
                    </button>
                </header>
                <main className="flex-1 p-4 md:p-6">{children}</main>
            </div>
        </AuthGuard>
    );
}
