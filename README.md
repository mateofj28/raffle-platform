# Raffle Platform

Plataforma de administración integral de rifas. Multi-tenant, con gestión de boletas, vendedores, clientes, pagos y comisiones.

---

## Stack tecnológico

- **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS 4, HeroUI v3
- **Backend:** Firebase Cloud Functions (Node.js 22, CommonJS)
- **Base de datos:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Storage:** Firebase Storage

---

## Requisitos previos

Antes de comenzar, asegúrate de tener instalado:

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | v20+ | https://nodejs.org |
| npm | v9+ | Incluido con Node |
| Firebase CLI | v13+ | `npm install -g firebase-tools` |
| Java JDK | **v21+** | https://adoptium.net (Eclipse Temurin 21) |

> ⚠️ **Java 21 es obligatorio** para el emulador de Firestore. Con Java 17 o inferior falla.

---

## Configuración inicial (solo la primera vez)

### 1. Clonar el repositorio

```bash
git clone https://github.com/mateofj28/raffle-platform.git
cd raffle-platform
```

### 2. Instalar dependencias del frontend

```bash
npm install
```

### 3. Instalar dependencias de Cloud Functions

```bash
cd functions
npm install
cd ..
```

### 4. Configurar variables de entorno

Copia el archivo de ejemplo y llena tus credenciales de Firebase:

```bash
copy .env.local.example .env.local
```

Edita `.env.local` con los datos de tu proyecto Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=tu-app-id
```

> Encuentra estos datos en: Firebase Console → Project Settings → Web App

### 5. Iniciar sesión en Firebase CLI

```bash
firebase login
firebase use raffle-platform-5c584
```

---

## Levantar el entorno local

Abre **3 terminales** en la carpeta del proyecto:

### Terminal 1 — Emuladores Firebase

```bash
npm run emulators
```

Espera hasta que aparezca:
```
✔  All emulators ready! It is now safe to connect your app.
```

> La primera vez tarda más porque descarga los JARs de los emuladores (~120 MB).

### Terminal 2 — Seed (solo la primera vez o después de limpiar datos)

```bash
npm run seed:emulator
```

Esto crea:
- Tenant: `empresa-principal`
- Usuario admin: `admin@rifas.com` / `Admin123!`
- Métricas inicializadas en cero

> Solo necesitas ejecutar esto una vez. Los datos persisten entre reinicios gracias a `--export-on-exit`.

### Terminal 3 — Frontend

```bash
npm run dev
```

---

## URLs locales

| Servicio | URL |
|---|---|
| **Aplicación web** | http://localhost:3000 |
| **Emulator UI** (panel Firebase) | http://localhost:4000 |
| **Firestore** | http://localhost:4000/firestore |
| **Authentication** | http://localhost:4000/auth |
| **Cloud Functions** | http://localhost:4000/functions |
| **Storage** | http://localhost:4000/storage |

---

## Credenciales de acceso (local)

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@rifas.com` | `Admin123!` |

---

## Scripts disponibles

```bash
# Frontend
npm run dev          # Inicia el servidor de desarrollo
npm run build        # Construye para producción
npm run start        # Inicia el servidor de producción

# Firebase Emuladores
npm run emulators    # Inicia emuladores con persistencia de datos
npm run emulators:build  # Compila las Cloud Functions

# Datos
npm run seed         # Crea admin en Firebase REAL (producción)
npm run seed:emulator  # Crea admin en el emulador local
```

---

## Estructura del proyecto

```
raffle-platform/
├── src/
│   ├── app/                    # Páginas Next.js (App Router)
│   │   ├── (admin)/            # Rutas del administrador
│   │   ├── (auth)/             # Login
│   │   └── vendor/             # Portal del vendedor
│   ├── components/             # Componentes reutilizables
│   ├── features/               # Módulos por feature (raffles, vendors, etc.)
│   ├── hooks/                  # Custom hooks globales
│   ├── lib/firebase/           # Configuración Firebase (cliente)
│   ├── services/               # Firebase callable wrapper
│   ├── store/                  # Zustand stores (auth, raffle, ui)
│   ├── types/                  # TypeScript types
│   ├── constants/              # Constantes (rutas, estados, departamentos)
│   └── utils/                  # Utilidades (formatters, validators)
│
├── functions/
│   └── src/
│       ├── services/           # Cloud Functions por dominio
│       ├── triggers/           # Firestore triggers automáticos
│       ├── scheduled/          # Funciones programadas
│       ├── middleware/         # Auth + validación
│       └── utils/              # Helpers internos
│
├── emulator-data/              # Datos persistidos del emulador (gitignored)
├── firestore.rules             # Reglas de seguridad Firestore
├── firestore.indexes.json      # Índices compuestos Firestore
├── storage.rules               # Reglas de seguridad Storage
└── firebase.json               # Configuración Firebase
```

---

## Flujo de trabajo local

```
Reiniciar PC
     │
     ▼
Terminal 1: npm run emulators
(esperar "All emulators ready")
     │
     ▼
Terminal 2: npm run seed:emulator
(solo si es primera vez o borraste datos)
     │
     ▼
Terminal 3: npm run dev
     │
     ▼
Abrir http://localhost:3000
Login: admin@rifas.com / Admin123!
```

---

## Persistencia de datos

Los datos del emulador se guardan automáticamente en `./emulator-data/` cuando cierras los emuladores con `Ctrl+C`.

La próxima vez que ejecutes `npm run emulators`, los datos se cargan automáticamente.

> Si quieres resetear la base de datos local, simplemente borra la carpeta `emulator-data/`.

---

## Despliegue a producción

### Requisitos
- Plan Blaze (pay-as-you-go) en Firebase para Cloud Functions
- Proyecto Firebase configurado

### Pasos

```bash
# 1. Desplegar reglas y índices de Firestore
firebase deploy --only firestore:rules,firestore:indexes

# 2. Desplegar Cloud Functions
firebase deploy --only functions

# 3. Frontend (Vercel)
vercel deploy --prod
# O Firebase Hosting:
firebase deploy --only hosting
```

---

## Solución de problemas comunes

| Problema | Solución |
|---|---|
| `firebase-tools` no encuentra Java | Instala JDK 21 desde https://adoptium.net |
| Port 8080 ya en uso | Mata el proceso: `taskkill /F /IM java.exe` |
| "Failed to parse build specification" | Verificar `engines.node` en `functions/package.json` (debe ser `"22"`) |
| Los datos desaparecen | Asegúrate de cerrar emuladores con `Ctrl+C` (no forzar) |
| `next build` falla | Borrar `.next/` y volver a compilar |
