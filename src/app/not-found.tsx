import Link from "next/link";
import { Button } from "@heroui/react";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <p className="text-8xl font-bold text-primary/20">404</p>
        </div>

        <h1 className="text-2xl font-bold mb-3">Página no encontrada</h1>
        <p className="text-default-500 mb-8">
          La página que buscas no existe o fue movida. Verifica la URL o vuelve al inicio.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/raffles">
            <Button variant="primary">
              <Home className="h-4 w-4" /> Ir al inicio
            </Button>
          </Link>
          <Button variant="outline" onPress={() => history.back()}>
            <ArrowLeft className="h-4 w-4" /> Volver atrás
          </Button>
        </div>
      </div>
    </div>
  );
}
