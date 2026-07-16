# Implementation Plan: Raffle Platform

## Overview

This plan implements a multi-tenant SaaS raffle management platform using Next.js 15 (App Router), React 19, TypeScript, TailwindCSS 4, HeroUI, and Firebase (Auth, Firestore, Cloud Functions 2nd gen, Cloud Storage). The implementation is organized into incremental phases: project setup, backend Cloud Functions, frontend features, and integration wiring.

## Tasks

- [x] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize Next.js 15 project with TypeScript, TailwindCSS 4, and HeroUI
    - Create Next.js 15 app with App Router
    - Configure TypeScript strict mode, TailwindCSS 4, and HeroUI plugin
    - Set up path aliases (`@/`) in tsconfig
    - Install all dependencies: TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Lucide React, TanStack Table
    - Create root layout with HeroUI provider and TanStack Query provider
    - _Requirements: 15.1, 15.2, 15.7_

  - [x] 1.2 Set up Firebase project configuration and initialization
    - Create `src/lib/firebase/config.ts` with Firebase app initialization
    - Create `src/lib/firebase/auth.ts` with Auth helpers
    - Create `src/lib/firebase/firestore.ts` with Firestore helpers
    - Create `src/lib/firebase/storage.ts` with Storage helpers
    - Create `src/services/firebase-callable.ts` generic callable wrapper
    - _Requirements: 1.5, 16.1_

  - [x] 1.3 Create shared types, constants, schemas, and utilities
    - Create `src/types/` with firebase.types.ts, api.types.ts, common.types.ts
    - Create `src/constants/` with routes.ts, roles.ts, statuses.ts (ticket and raffle state machines)
    - Create `src/schemas/common.schema.ts` with shared Zod schemas
    - Create `src/utils/` with formatters.ts, validators.ts, cn.ts
    - _Requirements: 3.1, 4.1, 17.1_

  - [x] 1.4 Set up Cloud Functions project structure
    - Initialize Firebase Functions project with 2nd gen
    - Create `functions/src/` directory structure: middleware/, services/, triggers/, scheduled/, types/, utils/
    - Configure TypeScript, ESLint, and Vitest for functions
    - Create `functions/src/middleware/auth.ts` for tenant + role validation
    - Create `functions/src/middleware/validation.ts` for Zod server-side schemas
    - Create `functions/src/utils/errors.ts` with AppErrorCode enum and custom error classes
    - Create `functions/src/utils/firestore.ts` with Firestore helpers
    - _Requirements: 1.3, 1.6, 2.5_

  - [x] 1.5 Create Firestore security rules and composite indexes
    - Write security rules enforcing tenant isolation via custom claims
    - Define vendor-scoped rules for ticket access
    - Create `firestore.indexes.json` with all composite indexes from design
    - _Requirements: 1.1, 2.4, 20.4_

- [ ] 2. Authentication and session management
  - [x] 2.1 Implement Cloud Function for user authentication and custom claims
    - Create auth service that sets custom claims (tenantId, role, vendorId) on first login
    - Implement role-based token generation
    - Implement account lockout after 5 failed attempts for 15 minutes
    - _Requirements: 1.2, 2.1, 16.4_

  - [x] 2.2 Implement frontend auth feature module
    - Create `src/features/auth/` with types, schemas, services, hooks, and components
    - Implement login form with React Hook Form + Zod validation
    - Create `use-auth.ts` hook with Firebase Auth state management
    - Create `use-session.ts` hook for session persistence (30-day)
    - Create `auth.store.ts` Zustand store for auth state (user, role, tenant)
    - Implement role-based redirect (admin → /admin/dashboard, vendor → /vendor/dashboard)
    - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.6_

  - [x] 2.3 Implement auth guard and route protection
    - Create `auth-guard.tsx` component for protected routes
    - Implement inactivity timeout (60 min) with redirect to login preserving destination URL
    - Implement middleware for route protection based on role
    - _Requirements: 2.2, 2.3, 2.7, 16.5_

  - [ ]* 2.4 Write property test for tenant data isolation
    - **Property 3: Tenant Data Isolation**
    - Test that every document read/write is scoped to exactly one tenantId matching authenticated user's custom claim
    - Test that cross-tenant access is rejected at Cloud Functions layer
    - **Validates: Requirements 1.1, 1.3, 1.4, 2.4**

- [ ] 3. Checkpoint - Verify authentication flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Raffle management backend
  - [x] 4.1 Implement raffle service Cloud Functions
    - Create `functions/src/services/raffle.service.ts`
    - Implement `createRaffle` callable: creates raffle in Draft state, triggers ticket generation
    - Implement `updateRaffle` callable: updates fields, blocks modifications on Finished/Cancelled raffles
    - Implement `transitionRaffleState` callable: enforces state machine (Draft→Active→Finished, Draft/Active→Cancelled)
    - Implement `setWinningNumber` callable: sets winner on Finished raffle, marks matching ticket
    - Validate all transitions against allowed state machine
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [x] 4.2 Implement ticket service Cloud Functions
    - Create `functions/src/services/ticket.service.ts`
    - Implement batch ticket generation (500 per batch) on raffle creation
    - Implement `assignTickets` callable: Available→Assigned (batch, range-based)
    - Implement `sellTicket` callable with Firestore transaction: Assigned→Sold, links customer
    - Implement `cancelTicket` callable: transitions to Cancelled (guards against Paid/Winner)
    - Implement concurrency control via Firestore transactions for ticket sales
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 19.1, 19.2, 19.3, 19.4, 20.2_

  - [ ]* 4.3 Write property test for ticket state machine validity
    - **Property 5: State Machine Validity**
    - Test that only valid transitions are allowed for raffles and tickets
    - Test that invalid transitions are rejected
    - Test terminal states (Winner, Cancelled for tickets; Finished, Cancelled for raffles)
    - **Validates: Requirements 3.1, 3.10, 4.1, 4.7, 4.10, 4.11**

  - [ ]* 4.4 Write property test for ticket uniqueness and single sale
    - **Property 2: Ticket Uniqueness and Single Sale**
    - Test that no two tickets within the same raffle have the same number
    - Test that a ticket can only be sold (transition to Sold) exactly once
    - Test concurrent sale attempts result in exactly one success
    - **Validates: Requirements 4.7, 19.1, 19.2**

- [ ] 5. Payment and commission backend
  - [x] 5.1 Implement payment service Cloud Functions
    - Create `functions/src/services/payment.service.ts`
    - Implement `registerPayment` callable: records payment/installment, reduces pending balance
    - Validate payment does not exceed pending balance
    - Reject payment on tickets with zero pending balance
    - Enforce minimum installment amount of 1 currency unit
    - Auto-transition ticket to Paid when pending balance reaches zero
    - Maintain chronological payment history
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 5.2 Implement financial reversal Cloud Functions
    - Implement `reversePayment` callable: creates adjustment record, adds reversal amount back to pending balance
    - Validate reversal does not exceed original transaction amount
    - Reject reversal on fully reversed transactions
    - Never delete or modify original payment record
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.3 Implement commission service and Firestore triggers
    - Create `functions/src/services/commission.service.ts`
    - Implement `onPaymentCreated` trigger: auto-calculate commission when pending balance = 0
    - Commission = floor(ticketValue * 0.30), company profit = ceil(ticketValue * 0.70)
    - Implement `onAdjustmentCreated` trigger: reverse commission if pending balance > 0
    - Implement `payCommission` callable: marks commission as Paid
    - Track commission status transitions: Generated→Paid, Generated→Reversed, Paid→Reversed
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 5.4 Write property test for financial integrity
    - **Property 1: Financial Integrity**
    - Test that sum of payments minus sum of adjustments equals ticketValue - pendingBalance
    - Test that payment and adjustment records are never deleted or modified
    - **Validates: Requirements 7.1, 7.2, 7.7, 8.3, 8.4**

  - [ ]* 5.5 Write property test for commission accuracy
    - **Property 4: Commission Accuracy**
    - Test commission generated if and only if pendingBalance == 0
    - Test commission amount = floor(ticketValue * 0.30)
    - Test company profit = ceil(ticketValue * 0.70)
    - Test reversal that makes pendingBalance > 0 reverses commission
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 6. Checkpoint - Verify backend business logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Supporting backend services
  - [x] 7.1 Implement customer service Cloud Functions
    - Create `functions/src/services/customer.service.ts`
    - Implement `createCustomer` callable: validates required fields, enforces document uniqueness within tenant
    - Implement `updateCustomer` callable: validates constraints, rejects duplicate document
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 7.2 Implement vendor service Cloud Functions
    - Create `functions/src/services/vendor.service.ts`
    - Implement `createVendor` callable: creates vendor record linked to auth user
    - Implement `updateVendor` callable: updates vendor status/info
    - Implement `getVendorMetrics` callable: computes all vendor KPIs (assigned, sold, paid, money collected, commission, ranking)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.3 Implement dashboard metrics and scheduled functions
    - Create `functions/src/services/dashboard.service.ts`
    - Implement `getDashboardMetrics` callable: returns pre-aggregated data
    - Implement `aggregateMetrics` scheduled function (every 5 min): pre-compute sales, raffles, people, financial metrics
    - Implement `onTicketStatusChanged` trigger: incremental counter updates via FieldValue.increment()
    - Create metrics document structure in `tenants/{tenantId}/metrics/`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

  - [x] 7.4 Implement audit trail service and trigger
    - Create `functions/src/services/audit.service.ts`
    - Implement `auditLogger` trigger: creates audit trail entry on critical operations
    - Ensure entries are immutable, include all required fields (operation type, entity, user, tenant, timestamp, IP)
    - Implement retry logic (up to 3 times) on audit entry creation failure
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [x] 7.5 Implement search and export Cloud Functions
    - Create `functions/src/services/search.service.ts`
    - Implement `globalSearch` callable: prefix matching + exact matching across customers, tickets, vendors, raffles
    - Create `functions/src/services/export.service.ts`
    - Implement `exportData` callable: generates xlsx (exceljs) and pdf (pdfkit), uploads to Cloud Storage, returns signed URL (15 min)
    - Implement `cleanupExports` scheduled function (daily): remove expired files
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 13.1, 13.2, 13.3, 13.5, 13.6, 13.7_

  - [ ]* 7.6 Write property test for audit completeness
    - **Property 6: Audit Completeness**
    - Test that every state-changing operation on critical entities produces exactly one immutable audit trail entry
    - Test that audit entries contain all required fields
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [ ] 8. Checkpoint - Verify all backend services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Frontend layout and shared components
  - [x] 9.1 Create layout components (sidebar, header, breadcrumbs)
    - Create `src/components/layout/sidebar.tsx` with HeroUI Listbox navigation
    - Create `src/components/layout/header.tsx` with search input, notifications, user menu, theme toggle
    - Create `src/components/layout/breadcrumbs.tsx`
    - Create `src/components/layout/theme-toggle.tsx` with dark/light persistence
    - Create admin layout (`src/app/(admin)/layout.tsx`) with sidebar + header
    - Create vendor layout (`src/app/(vendor)/layout.tsx`) with vendor nav
    - Create auth layout (`src/app/(auth)/layout.tsx`)
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 9.2 Create shared UI components
    - Create `src/components/ui/data-table.tsx` wrapping TanStack Table with HeroUI Table, sorting, and pagination
    - Create `src/components/ui/stat-card.tsx` using HeroUI Card
    - Create `src/components/ui/status-badge.tsx` using HeroUI Chip (colored by state)
    - Create `src/components/ui/search-input.tsx` with debounce
    - Create `src/components/ui/date-range-picker.tsx`
    - Create `src/components/ui/confirm-dialog.tsx` using HeroUI Modal
    - Create `src/components/ui/loading-skeleton.tsx` using HeroUI Skeleton
    - Create `src/components/shared/` (empty-state, error-boundary, page-header, export-button)
    - _Requirements: 15.1, 15.5, 15.6_

  - [x] 9.3 Set up Zustand stores and shared hooks
    - Create `src/store/auth.store.ts` (user session, role, tenant)
    - Create `src/store/ui.store.ts` (theme, sidebar collapsed state)
    - Create `src/store/search.store.ts` (global search state)
    - Create `src/hooks/use-firestore-listener.ts` (real-time listener pattern with TanStack Query integration)
    - Create `src/hooks/use-pagination.ts`
    - Create `src/hooks/use-debounce.ts`
    - Create `src/hooks/use-toast.ts`
    - Create `src/lib/query-client.ts` (TanStack Query config)
    - _Requirements: 14.3, 14.4, 14.5_

- [ ] 10. Frontend feature modules - Raffles
  - [x] 10.1 Implement raffle feature services, types, and hooks
    - Create `src/features/raffles/types/raffle.types.ts` and `ticket.types.ts`
    - Create `src/features/raffles/schemas/raffle.schema.ts` and `ticket.schema.ts`
    - Create `src/features/raffles/services/raffle.service.ts` and `ticket.service.ts` (callable wrappers)
    - Create `src/features/raffles/hooks/use-raffles.ts`, `use-raffle.ts`, `use-tickets.ts` (TanStack Query hooks)
    - Create `src/features/raffles/constants/raffle.constants.ts`
    - _Requirements: 3.8, 4.2, 17.1_

  - [x] 10.2 Implement raffle list and creation pages
    - Create `src/app/(admin)/raffles/page.tsx` with raffle table (status filter, pagination)
    - Create `src/features/raffles/components/raffle-table.tsx` using data-table
    - Create `src/features/raffles/components/raffle-card.tsx`
    - Create `src/features/raffles/components/raffle-status-badge.tsx`
    - Create `src/app/(admin)/raffles/new/page.tsx` with raffle creation form
    - Create `src/features/raffles/components/raffle-form.tsx` (React Hook Form + Zod)
    - _Requirements: 3.2, 3.8, 15.1, 17.1, 17.2, 17.3_

  - [x] 10.3 Implement raffle detail and ticket management pages
    - Create `src/app/(admin)/raffles/[id]/page.tsx` with raffle detail view (tabs: info, tickets, payments)
    - Create `src/app/(admin)/raffles/[id]/tickets/page.tsx` with ticket grid view
    - Create `src/features/raffles/components/ticket-grid.tsx` (visual ticket grid with color-coded states)
    - Create `src/features/raffles/components/ticket-assign-modal.tsx` (range-based assignment)
    - Create `src/features/raffles/components/ticket-sell-modal.tsx` (sell to customer)
    - Create `src/features/raffles/components/winner-selector.tsx`
    - Create `src/app/(admin)/raffles/[id]/edit/page.tsx`
    - Wire real-time listeners for ticket status updates
    - _Requirements: 3.3, 3.4, 3.5, 3.9, 4.4, 4.5, 4.6, 14.1, 15.1_

- [ ] 11. Frontend feature modules - Vendors, Customers, Payments
  - [x] 11.1 Implement vendor feature module
    - Create `src/features/vendors/` complete module (types, schemas, services, hooks)
    - Create `src/features/vendors/components/vendor-form.tsx`
    - Create `src/features/vendors/components/vendor-table.tsx`
    - Create `src/features/vendors/components/vendor-metrics-card.tsx`
    - Create `src/features/vendors/components/vendor-ranking.tsx`
    - Create `src/app/(admin)/vendors/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
    - _Requirements: 6.1, 6.2, 6.4, 15.1, 17.1_

  - [x] 11.2 Implement customer feature module
    - Create `src/features/customers/` complete module (types, schemas, services, hooks)
    - Create `src/features/customers/components/customer-form.tsx`
    - Create `src/features/customers/components/customer-table.tsx`
    - Create `src/features/customers/components/customer-history.tsx` (raffles, tickets, payments)
    - Create `src/app/(admin)/customers/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
    - _Requirements: 5.1, 5.2, 5.4, 15.1, 17.1_

  - [x] 11.3 Implement payment feature module
    - Create `src/features/payments/` complete module (types, schemas, services, hooks)
    - Create `src/features/payments/components/payment-form.tsx` (full payment + installment)
    - Create `src/features/payments/components/payment-table.tsx`
    - Create `src/features/payments/components/payment-history.tsx` (chronological per ticket)
    - Create `src/features/payments/components/reversal-form.tsx`
    - Create `src/app/(admin)/payments/page.tsx`
    - Wire real-time listeners for payment updates
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 14.2, 15.1, 17.1_

- [ ] 12. Frontend feature modules - Dashboard, Reports, Audit
  - [x] 12.1 Implement dashboard feature module
    - Create `src/features/dashboard/` complete module (types, services, hooks)
    - Create `src/features/dashboard/components/metrics-grid.tsx`
    - Create `src/features/dashboard/components/sales-chart.tsx`
    - Create `src/features/dashboard/components/top-vendors-card.tsx`
    - Create `src/features/dashboard/components/raffle-summary-card.tsx`
    - Create `src/features/dashboard/components/financial-summary.tsx`
    - Create `src/app/(admin)/dashboard/page.tsx`
    - Implement error state with retry option and zero-value state handling
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 12.2 Implement reports and export feature module
    - Create `src/features/reports/` complete module (hooks, services, components)
    - Create `src/features/reports/components/report-filters.tsx`
    - Create `src/features/reports/components/export-panel.tsx` (Excel + PDF options)
    - Create `src/app/(admin)/reports/page.tsx`
    - Implement progress indicator during export generation
    - Handle export errors (timeout, empty data, limit exceeded)
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7_

  - [x] 12.3 Implement audit trail page
    - Create `src/app/(admin)/audit/page.tsx`
    - Implement audit log table with filtering (operation type, date range, user, entity)
    - Implement pagination (max 100 per page)
    - Restrict results to current tenant
    - _Requirements: 11.4, 11.6_

  - [x] 12.4 Implement global search functionality
    - Create search UI in header with debounced input
    - Implement search results dropdown showing categorized results (customers, tickets, vendors, raffles)
    - Handle empty results state
    - Apply AND logic for combined filters
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 13. Vendor self-service portal
  - [x] 13.1 Implement vendor portal pages and components
    - Create `src/app/(vendor)/dashboard/page.tsx` with vendor financial summary
    - Create `src/app/(vendor)/tickets/page.tsx` with paginated ticket list (max 50 per page)
    - Create `src/app/(vendor)/payments/page.tsx` for payment registration
    - Implement vendor-scoped data fetching (only own tickets, payments, commissions)
    - Implement payment registration form with authorization validation
    - Display vendor metrics: money collected, commission earned, commission paid, pending balance
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 14. Real-time updates and optimistic UI
  - [x] 14.1 Wire real-time Firestore listeners across the application
    - Attach ticket status listeners on raffle detail/ticket views
    - Attach payment listeners on payment views
    - Implement connectivity warning banner on listener disconnect
    - Implement automatic reconnection logic
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

  - [x] 14.2 Implement optimistic updates and error reversion
    - Configure TanStack Query mutations with optimistic updates for all user-initiated actions
    - Implement rollback on server rejection with error toast notification
    - Ensure UI reverts to server state on rejection with explanation
    - _Requirements: 14.4, 14.6_

- [ ] 15. Checkpoint - Verify full frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Form validation, animations, and responsive polish
  - [x] 16.1 Implement form validation patterns across all forms
    - Ensure all forms use Zod schemas + React Hook Form
    - Implement on-blur validation with error display within 200ms
    - Implement form submission with inline error display (no page reload)
    - Handle server-side validation errors displayed adjacent to relevant fields
    - Retain user-entered data on validation failure
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [x] 16.2 Implement animations, responsive design, and accessibility
    - Add Framer Motion page transitions and component animations (max 400ms)
    - Implement reduced-motion preference detection and disable non-essential animations
    - Verify responsive layout from 320px to 2560px (no horizontal scroll, no clipping)
    - Ensure LCP within 3 seconds on 10 Mbps connection
    - _Requirements: 15.3, 15.4, 15.5, 15.6_

- [ ] 17. Settings page and final wiring
  - [x] 17.1 Implement settings page
    - Create `src/app/(admin)/settings/page.tsx`
    - Create `src/features/settings/components/settings-form.tsx`
    - Create `src/features/settings/services/settings.service.ts`
    - _Requirements: 15.2_

  - [x] 17.2 Wire all Cloud Functions exports and deploy configuration
    - Create `functions/src/index.ts` exporting all callable functions, triggers, and scheduled functions
    - Configure Firebase deploy settings for functions
    - Ensure all 17 callable, 4 triggers, and 2 scheduled functions are properly exported
    - _Requirements: 1.3, 1.5, 20.1_

- [ ] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout (frontend and Cloud Functions)
- All Cloud Functions use 2nd gen with Zod validation on both client and server
- HeroUI components are used for all UI elements as specified in the design
- Firestore transactions are critical for ticket sale concurrency control
- Batch operations (ticket generation) use 500 per batch to respect Firestore limits

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.5"] },
    { "id": 2, "tasks": ["2.1", "9.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "9.2", "9.3"] },
    { "id": 4, "tasks": ["2.4", "4.1", "7.1", "7.2"] },
    { "id": 5, "tasks": ["4.2", "5.1", "7.4"] },
    { "id": 6, "tasks": ["4.3", "4.4", "5.2", "5.3", "7.3", "7.5"] },
    { "id": 7, "tasks": ["5.4", "5.5", "7.6"] },
    { "id": 8, "tasks": ["10.1", "11.1", "11.2", "11.3"] },
    { "id": 9, "tasks": ["10.2", "10.3", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 10, "tasks": ["13.1", "14.1"] },
    { "id": 11, "tasks": ["14.2", "16.1"] },
    { "id": 12, "tasks": ["16.2", "17.1", "17.2"] }
  ]
}
```
