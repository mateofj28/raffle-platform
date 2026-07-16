# Technical Design Document

## Overview

This document defines the technical architecture for a multi-tenant SaaS raffle management platform built with Next.js 15 (App Router) and Firebase as Backend-as-a-Service. The design prioritizes data isolation, financial integrity, scalability to 10,000+ active raffles per tenant with up to 50,000 tickets each, and a clean separation between frontend presentation and backend business logic via Cloud Functions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App Router (React 19 + TypeScript)            │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐  │  │
│  │  │ HeroUI  │ │ Zustand  │ │ TanStack  │ │React Hook  │  │  │
│  │  │Components│ │  Store   │ │  Query    │ │   Form     │  │  │
│  │  └─────────┘ └──────────┘ └───────────┘ └────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (Firebase SDK)
┌─────────────────────────▼───────────────────────────────────────┐
│                     FIREBASE SERVICES                             │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │   Firebase   │ │  Firestore   │ │    Cloud Functions       │ │
│  │     Auth     │ │  (Database)  │ │  (Business Logic Layer)  │ │
│  │              │ │              │ │                           │ │
│  │ - Email/Pass │ │ - Real-time  │ │ - Callable Functions     │ │
│  │ - Custom     │ │ - Security   │ │ - Firestore Triggers     │ │
│  │   Claims     │ │   Rules      │ │ - Scheduled Functions    │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
│  ┌──────────────┐                                               │
│  │   Cloud      │                                               │
│  │   Storage    │                                               │
│  │ - Images     │                                               │
│  │ - Exports    │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Collection Structure (Multi-Tenant)

```
tenants/{tenantId}
  ├── profile (document fields: name, plan, createdAt, settings)
  │
  ├── raffles/{raffleId}
  │   ├── Fields: name, description, imageUrl, prize, startDate,
  │   │          endDate, drawDate, lottery, winningNumber, status,
  │   │          ticketPrice, totalTickets, createdAt, updatedAt, createdBy
  │   │
  │   └── tickets/{ticketNumber}  (document ID = ticket number padded)
  │       └── Fields: number, status, customerId, vendorId, saleDate,
  │                   value, pendingBalance, createdAt, updatedAt
  │
  ├── customers/{customerId}
  │   └── Fields: name, document, phone, whatsapp, address, city,
  │              createdAt, updatedAt, createdBy
  │
  ├── vendors/{vendorId}
  │   └── Fields: name, document, phone, whatsapp, status, userId,
  │              createdAt, updatedAt, createdBy
  │
  ├── payments/{paymentId}
  │   └── Fields: ticketId, raffleId, customerId, vendorId, amount,
  │              type (payment|installment), method, date, observations,
  │              createdAt, createdBy
  │
  ├── adjustments/{adjustmentId}
  │   └── Fields: paymentId, ticketId, raffleId, amount, reason,
  │              authorizedBy, createdAt
  │
  ├── commissions/{commissionId}
  │   └── Fields: ticketId, raffleId, vendorId, ticketValue,
  │              commissionAmount, companyProfit, status, generatedAt,
  │              paidAt, reversedAt
  │
  ├── auditTrail/{auditId}
  │   └── Fields: operationType, entityType, entityId, userId,
  │              timestamp, ipAddress, metadata
  │
  └── metrics/{metricType}
      └── Fields: (aggregated counters updated by Cloud Functions)
```

### Composite Indexes

| Collection | Fields | Purpose |
|---|---|---|
| `tickets` | `raffleId` + `status` | Filter tickets by raffle and state |
| `tickets` | `vendorId` + `status` | Vendor portal: my tickets by state |
| `tickets` | `customerId` + `raffleId` | Customer history per raffle |
| `payments` | `raffleId` + `date` | Payment reports by date range |
| `payments` | `vendorId` + `date` | Vendor payment history |
| `payments` | `ticketId` + `createdAt` | Ticket payment timeline |
| `commissions` | `vendorId` + `status` | Vendor commission summary |
| `auditTrail` | `operationType` + `timestamp` | Audit filtering |
| `raffles` | `status` + `createdAt` | Active/finished raffle listings |

### Security Rules Strategy

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All data lives under tenant scope
    match /tenants/{tenantId}/{document=**} {
      // Only allow access if user's custom claim matches tenant
      allow read, write: if request.auth != null
        && request.auth.token.tenantId == tenantId;
    }

    // Vendor-scoped rules (tickets they own)
    match /tenants/{tenantId}/tickets/{ticketId} {
      allow read: if request.auth != null
        && request.auth.token.tenantId == tenantId
        && (request.auth.token.role == 'admin'
            || resource.data.vendorId == request.auth.uid);
    }
  }
}
```

## Cloud Functions Architecture

### Function Categories

#### 1. Callable Functions (Client-invoked via Firebase SDK)

| Function | Trigger | Description | Req |
|---|---|---|---|
| `createRaffle` | callable | Creates raffle in Draft state, generates tickets | R3, R4 |
| `updateRaffle` | callable | Updates raffle fields (blocked if Finished) | R3 |
| `transitionRaffleState` | callable | State machine: Draft→Active→Finished/Cancelled | R3 |
| `setWinningNumber` | callable | Sets winner on Finished raffle | R3 |
| `assignTickets` | callable | Assigns ticket range to vendor (batch) | R4 |
| `sellTicket` | callable | Transitions Assigned→Sold, links customer | R4, R19 |
| `cancelTicket` | callable | Transitions to Cancelled (guards) | R4 |
| `registerPayment` | callable | Records payment/installment, updates balance | R7 |
| `reversePayment` | callable | Creates adjustment record, recalculates balance | R8 |
| `createCustomer` | callable | Validates uniqueness, persists customer | R5 |
| `updateCustomer` | callable | Validates constraints, updates customer | R5 |
| `createVendor` | callable | Creates vendor record linked to auth user | R6 |
| `updateVendor` | callable | Updates vendor status/info | R6 |
| `getVendorMetrics` | callable | Computes vendor KPIs on demand | R6 |
| `getDashboardMetrics` | callable | Returns pre-aggregated dashboard data | R10 |
| `exportData` | callable | Generates Excel/PDF, stores in Cloud Storage | R13 |
| `globalSearch` | callable | Searches across entities with filters | R12 |
| `payCommission` | callable | Marks commission as Paid | R9 |

#### 2. Firestore Triggers (Automatic on data changes)

| Function | Trigger | Description | Req |
|---|---|---|---|
| `onPaymentCreated` | onCreate payments | Auto-calculate commission when balance=0 | R9 |
| `onTicketStatusChanged` | onUpdate tickets | Update aggregated metrics | R10 |
| `onAdjustmentCreated` | onCreate adjustments | Reverse commission if needed | R8, R9 |
| `auditLogger` | onWrite (all critical) | Creates audit trail entries | R11 |

#### 3. Scheduled Functions

| Function | Schedule | Description | Req |
|---|---|---|---|
| `aggregateMetrics` | Every 5 minutes | Pre-compute dashboard metrics | R10 |
| `cleanupExports` | Daily | Remove expired export files from Storage | R13 |

### Cloud Function Internal Architecture

```
functions/
  src/
    index.ts                    # Function exports
    middleware/
      auth.ts                   # Tenant + role validation
      validation.ts             # Zod schemas (server-side)
    services/
      raffle.service.ts         # Raffle business logic
      ticket.service.ts         # Ticket state machine + batch ops
      payment.service.ts        # Payment/installment processing
      commission.service.ts     # Commission calculation engine
      customer.service.ts       # Customer CRUD + uniqueness
      vendor.service.ts         # Vendor CRUD + metrics
      dashboard.service.ts      # Metrics aggregation
      export.service.ts         # Excel/PDF generation
      search.service.ts         # Global search logic
      audit.service.ts          # Audit trail creation
    triggers/
      payment.triggers.ts       # onPaymentCreated
      ticket.triggers.ts        # onTicketStatusChanged
      adjustment.triggers.ts    # onAdjustmentCreated
    scheduled/
      metrics.scheduled.ts      # aggregateMetrics
      cleanup.scheduled.ts      # cleanupExports
    types/
      index.ts                  # Shared types
    utils/
      firestore.ts              # Firestore helpers
      errors.ts                 # Custom error classes
```

### Concurrency Control (Ticket Sales)

```typescript
// Firestore transaction ensures atomic ticket sale
async function sellTicket(tenantId: string, raffleId: string, 
  ticketNumber: string, customerId: string, vendorId: string) {
  
  return firestore.runTransaction(async (transaction) => {
    const ticketRef = db.doc(
      `tenants/${tenantId}/raffles/${raffleId}/tickets/${ticketNumber}`
    );
    const ticket = await transaction.get(ticketRef);
    
    if (!ticket.exists) throw new NotFoundError('Ticket not found');
    if (ticket.data().status !== 'assigned') {
      throw new ConflictError('Ticket is no longer available');
    }
    if (ticket.data().vendorId !== vendorId) {
      throw new ForbiddenError('Not authorized for this ticket');
    }
    
    transaction.update(ticketRef, {
      status: 'sold',
      customerId,
      saleDate: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
}
```

## Frontend Architecture

### Project Structure

```
src/
├── app/                              # Next.js 15 App Router
│   ├── (auth)/                       # Auth layout group
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (admin)/                      # Admin layout group
│   │   ├── dashboard/page.tsx
│   │   ├── raffles/
│   │   │   ├── page.tsx              # List raffles
│   │   │   ├── new/page.tsx          # Create raffle
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Raffle detail
│   │   │       ├── tickets/page.tsx  # Raffle tickets
│   │   │       └── edit/page.tsx     # Edit raffle
│   │   ├── tickets/page.tsx          # Global tickets view
│   │   ├── vendors/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── audit/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx               # Admin sidebar + header
│   ├── (vendor)/                     # Vendor layout group
│   │   ├── dashboard/page.tsx
│   │   ├── tickets/page.tsx
│   │   ├── payments/page.tsx
│   │   └── layout.tsx               # Vendor nav
│   ├── layout.tsx                    # Root layout (providers)
│   └── globals.css
├── components/
│   ├── ui/                           # HeroUI wrappers/extensions
│   │   ├── data-table.tsx
│   │   ├── stat-card.tsx
│   │   ├── status-badge.tsx
│   │   ├── search-input.tsx
│   │   ├── date-range-picker.tsx
│   │   ├── confirm-dialog.tsx
│   │   └── loading-skeleton.tsx
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── theme-toggle.tsx
│   └── shared/
│       ├── empty-state.tsx
│       ├── error-boundary.tsx
│       ├── page-header.tsx
│       └── export-button.tsx
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── login-form.tsx
│   │   │   └── auth-guard.tsx
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   └── use-session.ts
│   │   ├── services/
│   │   │   └── auth.service.ts
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   └── schemas/
│   │       └── login.schema.ts
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── metrics-grid.tsx
│   │   │   ├── sales-chart.tsx
│   │   │   ├── top-vendors-card.tsx
│   │   │   ├── raffle-summary-card.tsx
│   │   │   └── financial-summary.tsx
│   │   ├── hooks/
│   │   │   └── use-dashboard-metrics.ts
│   │   ├── services/
│   │   │   └── dashboard.service.ts
│   │   └── types/
│   │       └── dashboard.types.ts
│   ├── raffles/
│   │   ├── components/
│   │   │   ├── raffle-form.tsx
│   │   │   ├── raffle-card.tsx
│   │   │   ├── raffle-table.tsx
│   │   │   ├── raffle-status-badge.tsx
│   │   │   ├── ticket-grid.tsx
│   │   │   ├── ticket-assign-modal.tsx
│   │   │   ├── ticket-sell-modal.tsx
│   │   │   └── winner-selector.tsx
│   │   ├── hooks/
│   │   │   ├── use-raffles.ts
│   │   │   ├── use-raffle.ts
│   │   │   └── use-tickets.ts
│   │   ├── services/
│   │   │   ├── raffle.service.ts
│   │   │   └── ticket.service.ts
│   │   ├── types/
│   │   │   ├── raffle.types.ts
│   │   │   └── ticket.types.ts
│   │   ├── schemas/
│   │   │   ├── raffle.schema.ts
│   │   │   └── ticket.schema.ts
│   │   └── constants/
│   │       └── raffle.constants.ts
│   ├── vendors/
│   │   ├── components/
│   │   │   ├── vendor-form.tsx
│   │   │   ├── vendor-table.tsx
│   │   │   ├── vendor-metrics-card.tsx
│   │   │   └── vendor-ranking.tsx
│   │   ├── hooks/
│   │   │   ├── use-vendors.ts
│   │   │   └── use-vendor-metrics.ts
│   │   ├── services/
│   │   │   └── vendor.service.ts
│   │   ├── types/
│   │   │   └── vendor.types.ts
│   │   └── schemas/
│   │       └── vendor.schema.ts
│   ├── customers/
│   │   ├── components/
│   │   │   ├── customer-form.tsx
│   │   │   ├── customer-table.tsx
│   │   │   └── customer-history.tsx
│   │   ├── hooks/
│   │   │   └── use-customers.ts
│   │   ├── services/
│   │   │   └── customer.service.ts
│   │   ├── types/
│   │   │   └── customer.types.ts
│   │   └── schemas/
│   │       └── customer.schema.ts
│   ├── payments/
│   │   ├── components/
│   │   │   ├── payment-form.tsx
│   │   │   ├── payment-table.tsx
│   │   │   ├── payment-history.tsx
│   │   │   └── reversal-form.tsx
│   │   ├── hooks/
│   │   │   └── use-payments.ts
│   │   ├── services/
│   │   │   └── payment.service.ts
│   │   ├── types/
│   │   │   └── payment.types.ts
│   │   └── schemas/
│   │       └── payment.schema.ts
│   ├── reports/
│   │   ├── components/
│   │   │   ├── report-filters.tsx
│   │   │   └── export-panel.tsx
│   │   ├── hooks/
│   │   │   └── use-export.ts
│   │   └── services/
│   │       └── export.service.ts
│   └── settings/
│       ├── components/
│       │   └── settings-form.tsx
│       └── services/
│           └── settings.service.ts
├── hooks/                            # Shared hooks
│   ├── use-firestore-listener.ts
│   ├── use-pagination.ts
│   ├── use-debounce.ts
│   └── use-toast.ts
├── services/                         # Shared services
│   └── firebase-callable.ts          # Generic callable wrapper
├── store/                            # Zustand stores
│   ├── auth.store.ts
│   ├── ui.store.ts                   # Theme, sidebar state
│   └── search.store.ts
├── types/                            # Global types
│   ├── firebase.types.ts
│   ├── api.types.ts
│   └── common.types.ts
├── lib/
│   ├── firebase/
│   │   ├── config.ts                 # Firebase initialization
│   │   ├── auth.ts                   # Auth helpers
│   │   ├── firestore.ts             # Firestore helpers
│   │   └── storage.ts               # Storage helpers
│   └── query-client.ts              # TanStack Query config
├── schemas/                          # Shared Zod schemas
│   └── common.schema.ts
├── utils/
│   ├── formatters.ts                 # Currency, date formatters
│   ├── validators.ts                 # Common validators
│   └── cn.ts                         # Class name utility
└── constants/
    ├── routes.ts                     # Route constants
    ├── roles.ts                      # Role definitions
    └── statuses.ts                   # State machine constants
```

## Components and Interfaces

### State Management Strategy

| Concern | Tool | Justification |
|---|---|---|
| Server state (CRUD) | TanStack Query | Caching, optimistic updates, background refetch |
| Real-time data | Firestore listeners + custom hooks | Ticket/payment live updates |
| Global UI state | Zustand | Theme, sidebar, search state |
| Form state | React Hook Form + Zod | Validation, field management |
| Auth state | Zustand (persisted) | User session, role, tenant |

### Data Flow Pattern

```
User Action → React Hook Form (validation) 
  → TanStack Query mutation (optimistic update)
    → Firebase Callable Function
      → Cloud Function (auth + validation + business logic)
        → Firestore write
          → Firestore trigger (audit, commission, metrics)
            → Real-time listener updates all clients
```

### Key Design Patterns

**Service Pattern** — Each feature has a service file that wraps Firebase callable functions:

```typescript
// src/features/raffles/services/raffle.service.ts
import { callFunction } from '@/services/firebase-callable';
import { Raffle, CreateRaffleInput } from '../types/raffle.types';

export const raffleService = {
  create: (data: CreateRaffleInput) => 
    callFunction<Raffle>('createRaffle', data),
  
  transition: (raffleId: string, targetState: RaffleState) =>
    callFunction<Raffle>('transitionRaffleState', { raffleId, targetState }),
  
  setWinner: (raffleId: string, winningNumber: number) =>
    callFunction<{ winner: Ticket | null }>('setWinningNumber', { raffleId, winningNumber }),
};
```

**Hook Pattern** — Each feature exposes custom hooks using TanStack Query:

```typescript
// src/features/raffles/hooks/use-raffles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { raffleService } from '../services/raffle.service';

export function useRaffles(filters?: RaffleFilters) {
  return useQuery({
    queryKey: ['raffles', filters],
    queryFn: () => raffleService.list(filters),
  });
}

export function useCreateRaffle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: raffleService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raffles'] }),
  });
}
```

**Real-Time Listener Pattern:**

```typescript
// src/hooks/use-firestore-listener.ts
import { useEffect } from 'react';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';

export function useFirestoreListener(
  collectionPath: string,
  queryConstraints: QueryConstraint[],
  queryKey: string[]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const q = query(collection(db, collectionPath), ...queryConstraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      queryClient.setQueryData(queryKey, data);
    }, (error) => {
      // Handle disconnect — show connectivity warning
      console.error('Listener error:', error);
    });

    return () => unsubscribe();
  }, [collectionPath, queryKey]);
}
```

## Authentication Flow

```
┌──────────┐    ┌────────────────┐    ┌──────────────────┐
│  Login   │───▶│ Firebase Auth  │───▶│ Cloud Function   │
│  Form    │    │ signInWithEmail│    │ (set custom      │
└──────────┘    └────────────────┘    │  claims on       │
                                      │  first login)    │
                                      └────────┬─────────┘
                                               │
                                      ┌────────▼─────────┐
                                      │  Token includes: │
                                      │  - tenantId      │
                                      │  - role          │
                                      │  - vendorId      │
                                      └────────┬─────────┘
                                               │
                              ┌────────────────▼────────────────┐
                              │        Route based on role       │
                              ├─────────────────┬───────────────┤
                              │  Admin → /admin │ Vendor → /vendor│
                              │  /dashboard     │ /dashboard      │
                              └─────────────────┴────────────────┘
```

### Custom Claims Structure

```typescript
interface CustomClaims {
  tenantId: string;      // Tenant isolation key
  role: 'admin' | 'vendor';
  vendorId?: string;     // Only for vendor role
}
```

## Ticket State Machine

```
                    ┌───────────┐
                    │ Available │
                    └─────┬─────┘
                          │ assignTickets()
                    ┌─────▼─────┐
              ┌─────│ Assigned  │─────┐
              │     └─────┬─────┘     │
              │           │ sellTicket()
              │     ┌─────▼─────┐     │
              │     │   Sold    │     │
              │     └─────┬─────┘     │
              │           │ registerPayment()
              │     ┌─────▼───────┐   │
              │     │ Installment │   │
              │     └─────┬───────┘   │
              │           │ pendingBalance == 0
              │     ┌─────▼─────┐     │
              │     │   Paid    │     │
              │     └─────┬─────┘     │
              │           │ setWinningNumber()
              │     ┌─────▼─────┐     │
              │     │  Winner   │     │
              │     └───────────┘     │
              │                       │
              │ cancelTicket()        │ cancelTicket()
              │     ┌───────────┐     │
              └─────▶ Cancelled ◀─────┘
                    └───────────┘

Valid transitions:
  Available → Assigned (admin assigns to vendor)
  Assigned → Sold (vendor/admin sells to customer)
  Sold → Installment (partial payment registered)
  Sold → Paid (full payment registered)
  Installment → Paid (balance reaches zero)
  Paid → Winner (winning number matches)
  Available → Cancelled (admin cancels)
  Assigned → Cancelled (admin cancels)
  Sold → Cancelled (admin cancels)
```

## Commission Calculation Flow

```
Payment registered → Cloud Function trigger
  │
  ├─ Check: ticket.pendingBalance == 0?
  │   │
  │   ├─ YES → Calculate commission
  │   │         commission = floor(ticketValue * 0.30)
  │   │         companyProfit = ceil(ticketValue * 0.70)
  │   │         Create commission record (status: 'generated')
  │   │         Update ticket status to 'paid'
  │   │
  │   └─ NO → Update ticket status to 'installment'
  │            No commission generated yet
  │
  └─ Reversal scenario:
      Adjustment created → Check if commission exists
        │
        ├─ YES → ticket.pendingBalance > 0 now?
        │   │
        │   ├─ YES → Reverse commission (status: 'reversed')
        │   │         Update ticket status back to 'installment'
        │   │
        │   └─ NO → No change to commission
        │
        └─ NO → No action needed
```

## Dashboard Metrics Aggregation Strategy

### Pre-Aggregated Counters

To meet the 3-second dashboard load requirement (R10), metrics are pre-computed by a scheduled Cloud Function running every 5 minutes and stored in `tenants/{tenantId}/metrics/`:

```typescript
// tenants/{tenantId}/metrics/sales
{
  dailySales: number,          // Sales today (timezone-aware)
  monthlySales: number,        // Sales this month
  moneyCollected: number,      // Total collected
  moneyPending: number,        // Total pending
  lastUpdated: Timestamp
}

// tenants/{tenantId}/metrics/raffles
{
  activeCount: number,
  finishedCount: number,
  ticketsSold: number,
  ticketsAvailable: number,
  ticketsCancelled: number,
  lastUpdated: Timestamp
}

// tenants/{tenantId}/metrics/people
{
  vendorsCount: number,
  customersCount: number,
  topVendors: Array<{ id, name, salesCount }>,   // Top 5
  topRaffles: Array<{ id, name, revenue }>,      // Top 5
  topCustomers: Array<{ id, name, purchases }>,  // Top 5
  lastUpdated: Timestamp
}

// tenants/{tenantId}/metrics/financial
{
  commissionsPaid: number,
  commissionsPending: number,
  totalProfit: number,
  profitByRaffle: Array<{ raffleId, name, profit }>,
  dailyIncome: number,
  monthlyIncome: number,
  lastUpdated: Timestamp
}
```

### Incremental Updates

Additionally, critical counters (tickets sold, money collected) are updated incrementally via Firestore triggers on payment/ticket writes using `FieldValue.increment()` for near real-time accuracy between scheduled aggregations.

## Search Implementation

### Strategy

Firestore doesn't natively support full-text search. The platform uses a hybrid approach:

1. **Prefix matching** — For names and document numbers using Firestore `>=` and `<=` range queries
2. **Exact matching** — For ticket numbers, IDs, and status fields
3. **Cloud Function search** — For complex multi-entity queries that combine results from multiple collections

```typescript
// Cloud Function: globalSearch
async function globalSearch(tenantId: string, query: string, filters: Filters) {
  const results = await Promise.all([
    searchCustomers(tenantId, query, filters),
    searchTickets(tenantId, query, filters),
    searchVendors(tenantId, query, filters),
    searchRaffles(tenantId, query, filters),
  ]);
  
  return {
    customers: results[0],
    tickets: results[1],
    vendors: results[2],
    raffles: results[3],
  };
}
```

## Export Architecture

### Flow

```
Admin clicks Export → Cloud Function callable
  │
  ├─ Validate filters + row count
  ├─ If count == 0 → return error
  ├─ If count > limit → return error with suggestion
  │
  ├─ Generate file (xlsx via exceljs / pdf via pdfkit)
  ├─ Upload to Cloud Storage (tenants/{tenantId}/exports/{filename})
  ├─ Generate signed download URL (15 min expiry)
  └─ Return URL to client
```

### Libraries

| Format | Library | Reason |
|---|---|---|
| Excel (.xlsx) | `exceljs` | Streaming, handles large datasets |
| PDF | `pdfkit` | Lightweight, server-side generation |

## Error Handling

### Cloud Functions Error Codes

```typescript
enum AppErrorCode {
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  NOT_FOUND = 'not-found',
  CONFLICT = 'conflict',              // Duplicate, concurrency
  VALIDATION_ERROR = 'validation-error',
  INVALID_TRANSITION = 'invalid-transition',
  PAYMENT_EXCEEDS_BALANCE = 'payment-exceeds-balance',
  ALREADY_REVERSED = 'already-reversed',
  EXPORT_LIMIT_EXCEEDED = 'export-limit-exceeded',
}

interface AppError {
  code: AppErrorCode;
  message: string;
  fields?: Record<string, string>;   // For validation errors
}
```

### Frontend Error Handling

- TanStack Query `onError` callbacks display HeroUI toast notifications
- Form validation errors are displayed inline adjacent to fields
- Network errors trigger a connectivity banner
- Optimistic updates are reverted with explanation on server rejection

## Scalability Considerations

### Firestore Design Decisions

1. **Tickets as subcollection of Raffles** — Keeps ticket queries scoped and avoids scanning entire tenant ticket collection
2. **Payments as tenant-level collection** — Enables cross-raffle payment queries and date-range filtering
3. **Metrics pre-aggregation** — Avoids expensive real-time aggregation queries on dashboard load
4. **Batch ticket generation** — Uses Firestore batch writes (max 500 per batch) to create tickets on raffle creation
5. **Paginated queries everywhere** — Max 100 records per request, cursor-based pagination

### Batch Ticket Generation

For a raffle with 50,000 tickets:
- Split into 100 batches of 500 writes
- Execute batches sequentially to avoid quota limits
- Cloud Function timeout set to 540 seconds (9 min max)
- Progress tracked in raffle document for client polling

```typescript
async function generateTickets(tenantId: string, raffleId: string, count: number, price: number) {
  const BATCH_SIZE = 500;
  const batches = Math.ceil(count / BATCH_SIZE);
  
  for (let i = 0; i < batches; i++) {
    const batch = firestore.batch();
    const start = i * BATCH_SIZE + 1;
    const end = Math.min((i + 1) * BATCH_SIZE, count);
    
    for (let num = start; num <= end; num++) {
      const ticketRef = db.doc(
        `tenants/${tenantId}/raffles/${raffleId}/tickets/${String(num).padStart(5, '0')}`
      );
      batch.set(ticketRef, {
        number: num,
        status: 'available',
        value: price,
        pendingBalance: price,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
```

## UI/UX Design Decisions

### Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Header (logo, search, notifications, user menu, theme)  │
├────────────┬─────────────────────────────────────────────┤
│            │                                              │
│  Sidebar   │           Main Content Area                 │
│  (nav)     │                                              │
│            │  ┌─────────────────────────────────────┐    │
│  Dashboard │  │  Page Header + Actions              │    │
│  Raffles   │  ├─────────────────────────────────────┤    │
│  Tickets   │  │                                     │    │
│  Vendors   │  │  Content (tables, forms, cards)     │    │
│  Customers │  │                                     │    │
│  Payments  │  │                                     │    │
│  Reports   │  │                                     │    │
│  Audit     │  └─────────────────────────────────────┘    │
│  Settings  │                                              │
│            │                                              │
└────────────┴─────────────────────────────────────────────┘
```

### HeroUI Component Mapping

| Use Case | HeroUI Component |
|---|---|
| Navigation | `Navbar`, `Listbox` (sidebar) |
| Data Tables | `Table` with sorting + pagination |
| Forms | `Input`, `Select`, `Textarea`, `DatePicker` |
| Actions | `Button`, `Dropdown` |
| Status | `Chip` (colored by state) |
| Cards | `Card` (metrics, summaries) |
| Modals | `Modal` (create, edit, confirm) |
| Feedback | `Toast` (via Sonner), `Skeleton` |
| Tabs | `Tabs` (detail views) |
| Search | `Input` with autocomplete |
| Pagination | `Pagination` |
| File Upload | `Button` + Cloud Storage |

### Theme Configuration

```typescript
// tailwind.config.ts - HeroUI theme extension
import { heroui } from "@heroui/react";

export default {
  content: [
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: { DEFAULT: "#0070F3", foreground: "#FFFFFF" },
          success: { DEFAULT: "#17C964" },
          warning: { DEFAULT: "#F5A623" },
          danger: { DEFAULT: "#F31260" },
        },
      },
      dark: {
        colors: {
          primary: { DEFAULT: "#0070F3", foreground: "#FFFFFF" },
          success: { DEFAULT: "#17C964" },
          warning: { DEFAULT: "#F5A623" },
          danger: { DEFAULT: "#F31260" },
        },
      },
    },
  })],
};
```

## Code Conventions

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files (components) | kebab-case | `raffle-form.tsx` |
| Files (hooks) | kebab-case with `use-` prefix | `use-raffles.ts` |
| Files (services) | kebab-case with `.service` suffix | `raffle.service.ts` |
| Files (types) | kebab-case with `.types` suffix | `raffle.types.ts` |
| Files (schemas) | kebab-case with `.schema` suffix | `raffle.schema.ts` |
| Components | PascalCase | `RaffleForm` |
| Hooks | camelCase with `use` prefix | `useRaffles` |
| Services | camelCase object | `raffleService` |
| Types/Interfaces | PascalCase | `Raffle`, `CreateRaffleInput` |
| Enums | PascalCase | `RaffleStatus` |
| Constants | UPPER_SNAKE_CASE | `MAX_TICKETS_PER_RAFFLE` |
| Firestore collections | camelCase | `raffles`, `auditTrail` |
| Cloud Functions | camelCase | `createRaffle`, `sellTicket` |

### Import Order Convention

```typescript
// 1. React/Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. HeroUI components
import { Button, Card, Input } from '@heroui/react';

// 4. Internal - shared
import { callFunction } from '@/services/firebase-callable';

// 5. Internal - feature
import { raffleService } from '../services/raffle.service';
import { RaffleStatus } from '../types/raffle.types';
```

### TypeScript Strictness

- `strict: true` in tsconfig
- No `any` types (use `unknown` + type guards)
- Explicit return types on service functions
- Zod schemas for all external data boundaries (API, forms)

## Technology Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 15.x |
| UI Library | React | 19.x |
| Language | TypeScript | 5.x |
| Styling | TailwindCSS | 4.x |
| Components | HeroUI | 2.x |
| Server State | TanStack Query | 5.x |
| Client State | Zustand | 5.x |
| Forms | React Hook Form | 7.x |
| Validation | Zod | 3.x |
| Animations | Framer Motion | 11.x |
| Icons | Lucide React | latest |
| Tables | TanStack Table | 8.x |
| Auth | Firebase Auth | 10.x |
| Database | Firestore | 10.x |
| Functions | Cloud Functions | 2nd gen |
| Storage | Cloud Storage | 10.x |
| Excel Export | exceljs | 4.x |
| PDF Export | pdfkit | 0.15.x |

## Deployment Strategy

- **Frontend**: Vercel (optimized for Next.js) or Firebase Hosting
- **Cloud Functions**: Firebase deploy via `firebase deploy --only functions`
- **Environment Variables**: Firebase project config + API keys via `.env.local` (frontend) and Firebase Functions config (backend)
- **CI/CD**: GitHub Actions with separate workflows for frontend and functions

## Correctness Properties

### Property 1: Financial Integrity

The sum of all payments minus the sum of all adjustments for a ticket always equals `ticketValue - pendingBalance`. Payment and adjustment records are never deleted or modified after creation.

**Validates: Requirements 7, 8**

### Property 2: Ticket Uniqueness and Single Sale

No two tickets within the same raffle can have the same number. A ticket can only be sold (transition to Sold state) exactly once. Firestore transactions with read-before-write guarantee this under concurrency.

**Validates: Requirements 4, 19**

### Property 3: Tenant Data Isolation

Every document read or written is scoped to exactly one tenantId matching the authenticated user's custom claim. Cross-tenant access is rejected at both Security Rules and Cloud Functions layers.

**Validates: Requirements 1, 2**

### Property 4: Commission Accuracy

Commission is generated if and only if `pendingBalance == 0` for the ticket. Commission amount equals `floor(ticketValue * 0.30)`. Company profit equals `ceil(ticketValue * 0.70)`. A reversal that makes `pendingBalance > 0` automatically reverses the associated commission.

**Validates: Requirements 9**

### Property 5: State Machine Validity

- Raffle: Only forward transitions allowed (Draft→Active→Finished, Draft/Active→Cancelled). No backward transitions.
- Ticket: Only valid transitions as defined in the state machine diagram. Winner state is terminal.
- Commission: Generated→Paid or Generated→Reversed or Paid→Reversed. No other transitions.

**Validates: Requirements 3, 4**

### Property 6: Audit Completeness

Every state-changing operation on critical entities (raffles, tickets, payments, adjustments, commissions) produces exactly one immutable audit trail entry within 5 seconds.

**Validates: Requirements 11**

## Testing Strategy

### Unit Tests (Cloud Functions)

- Test each service function in isolation with mocked Firestore
- Test state machine transitions (valid and invalid)
- Test commission calculation with edge cases (rounding)
- Test validation logic (Zod schemas)
- Test error handling and error codes

### Integration Tests (Cloud Functions)

- Test callable functions end-to-end with Firebase emulator
- Test Firestore triggers fire correctly and produce expected side effects
- Test concurrent ticket sales produce exactly one winner
- Test payment → commission flow end-to-end
- Test reversal → commission reversal flow

### Frontend Tests

- Component tests with React Testing Library for critical forms
- Hook tests for TanStack Query hooks with mocked services
- E2E tests with Playwright for critical user flows:
  - Login → Create raffle → Assign tickets → Sell → Pay → Commission generated
  - Vendor login → View tickets → Register payment
  - Admin reversal flow

### Test Tools

| Layer | Tool |
|---|---|
| Cloud Functions unit | Vitest + firebase-functions-test |
| Cloud Functions integration | Firebase Emulator Suite |
| Frontend components | Vitest + React Testing Library |
| E2E | Playwright |
| API contracts | Zod schema tests |
