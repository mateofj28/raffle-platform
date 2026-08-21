"use client";

import Link from "next/link";
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

    return (
        <AuthGuard requiredRole={ROLES.VENDOR}>
            <div className="min-h-dvh flex flex-col">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 px-4" style={{ backgroundColor: "#001838" }}>
                    <span className="font-semibold text-white">Raffle Platform</span>
                    <nav className="flex-1 flex items-center gap-1 ml-6">
                        {VENDOR_NAV.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                        isActive ? "text-white" : "text-[#A0B4C8] hover:bg-white/10 hover:text-white"
                                    )}
                                    style={isActive ? { backgroundColor: "#0058D0" } : undefined}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                    <ThemeToggle />
                    <span className="text-sm text-[#A0B4C8] hidden md:inline">{user?.displayName || user?.email}</span>
                    <Button variant="ghost" size="sm" isIconOnly onPress={() => logout()} aria-label="Cerrar sesión">
                        <LogOut className="h-4 w-4 text-[#A0B4C8]" />
                    </Button>
                </header>
                <main className="flex-1 p-4 md:p-6">{children}</main>
            </div>
        </AuthGuard>
    );
}
