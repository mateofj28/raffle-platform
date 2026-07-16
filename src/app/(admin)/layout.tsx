"use client";

import { useState } from "react";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ROLES } from "@/constants/roles";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <AuthGuard requiredRole={ROLES.ADMIN}>
            <div className="flex min-h-dvh">
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />
                <div className="flex flex-1 flex-col">
                    <Header onMenuToggle={() => setSidebarOpen(true)} />
                    <main className="flex-1 p-4 md:p-6">
                        <div className="mb-4">
                            <Breadcrumbs />
                        </div>
                        {children}
                    </main>
                </div>
            </div>
        </AuthGuard>
    );
}
