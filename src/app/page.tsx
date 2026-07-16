import { Button } from "@heroui/react";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Raffle Platform</h1>
        <p className="text-default-500">
          Plataforma de administración integral de rifas
        </p>
        <Button variant="primary" size="lg">
          Comenzar
        </Button>
      </div>
    </main>
  );
}
