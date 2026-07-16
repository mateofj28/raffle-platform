import { LoginForm } from "@/features/auth/components/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
    return (
        <div className="w-full max-w-sm space-y-6 p-6">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Raffle Platform</h1>
                <p className="text-default-500 text-sm">
                    Inicia sesión para continuar
                </p>
            </div>
            <LoginForm />
        </div>
    );
}
