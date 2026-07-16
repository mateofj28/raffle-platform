# Requirements Document

## Introduction

A multi-tenant SaaS raffle management platform that enables raffle organizers (companies) to manage the complete lifecycle of raffles, including ticket sales, customer relationships, vendor management, payments, installments, commissions, and reporting. The platform is designed for high scalability (thousands of simultaneous raffles) with strict financial integrity guarantees. Each tenant operates in complete data isolation, enabling the platform to be sold as a service.

The system uses Firebase as a Backend-as-a-Service with all critical business logic executed in Cloud Functions. The frontend is built with Next.js 15, React 19, TypeScript, TailwindCSS 4, and HeroUI components.

## Glossary

- **Platform**: The multi-tenant SaaS raffle management system
- **Tenant**: A company or raffle organizer that subscribes to the Platform, operating with isolated data
- **Administrator**: A user with full control over a Tenant's raffles, vendors, customers, tickets, payments, and reports
- **Vendor**: A user associated with a Tenant who sells tickets, views their own assigned tickets, registers payments, and tracks commissions
- **Raffle**: A lottery-style game managed by a Tenant, containing thousands of tickets with a defined prize and draw date
- **Ticket** (Boleta): A numbered entry in a Raffle that can be sold to a Customer through a Vendor
- **Customer**: A person who purchases one or more Tickets across Raffles within a Tenant
- **Payment**: A financial transaction recording full or partial payment for a Ticket
- **Installment** (Abono): A partial payment toward the total value of a Ticket, reducing the pending balance
- **Commission**: The percentage (30%) of a Ticket value earned by the Vendor upon effective payment
- **Pending_Balance**: The remaining amount a Customer owes on a Ticket after installments
- **Adjustment_Record**: A reversal entry created when a financial movement must be corrected, preserving the original record
- **Audit_Trail**: A log recording who performed an operation, when, and contextual metadata
- **Cloud_Functions**: Firebase Cloud Functions where all critical business logic executes
- **Firestore**: The Firebase NoSQL database used for data storage
- **Security_Rules**: Firebase Security Rules enforcing data isolation between Tenants
- **Lottery**: The external lottery draw associated with a Raffle for determining the winning number
- **Winning_Number**: The number drawn from the Lottery that determines the winning Ticket
- **Dashboard**: The administrative overview screen showing key metrics and statistics
- **HeroUI**: The component library used for all UI elements in the frontend

## Requirements

### Requirement 1: Multi-Tenant Data Isolation

**User Story:** As a platform operator, I want each tenant's data to be completely isolated, so that no tenant can access another tenant's information.

#### Acceptance Criteria

1. THE Security_Rules SHALL enforce that all Firestore read and write operations are permitted only when the Tenant identifier in the document path matches the Tenant identifier in the authenticated user's auth token custom claims
2. WHEN a user authenticates, THE Platform SHALL embed exactly one Tenant identifier as a custom claim in the user's auth token before granting access to any tenant-scoped resource
3. THE Cloud_Functions SHALL verify that the Tenant identifier in the authenticated user's auth token custom claims matches the Tenant identifier referenced in the requested data operation before executing business logic
4. IF a request references data belonging to a different Tenant, THEN THE Cloud_Functions SHALL reject the request, return an authorization error that does not reveal the existence or details of the other Tenant's data, and preserve the requesting Tenant's data state unchanged
5. THE Firestore SHALL structure collections with Tenant identifier as the top-level partition key
6. IF a request is received with a missing or malformed Tenant identifier in the auth token custom claims, THEN THE Cloud_Functions SHALL reject the request and return an authentication error

### Requirement 2: Role-Based Access Control

**User Story:** As an administrator, I want to control what each user role can access, so that vendors only see their own data and administrators have full control.

#### Acceptance Criteria

1. THE Platform SHALL support exactly two roles: Administrator and Vendor
2. WHEN an Administrator authenticates, THE Platform SHALL grant access to all Tenant data including raffles, tickets, vendors, customers, payments, and reports
3. WHEN a Vendor authenticates, THE Platform SHALL grant access only to the Vendor's own assigned tickets, registered payments, and commission information
4. IF a Vendor attempts to access another Vendor's data, THEN THE Security_Rules SHALL deny the request and return an access-denied error indication to the Vendor
5. THE Cloud_Functions SHALL validate the user role before executing any data-modification operation (creating, updating, or deleting raffles, tickets, vendors, customers, payments, or reports) and any data-read operation outside the user's permitted scope
6. IF role validation fails in a Cloud Function, THEN THE Cloud_Functions SHALL reject the operation and return an error indicating insufficient permissions without executing the requested action
7. IF an unauthenticated request is received, THEN THE Platform SHALL deny access to all protected resources and return an error indicating that authentication is required

### Requirement 3: Raffle Lifecycle Management

**User Story:** As an administrator, I want to create and manage raffles through their complete lifecycle, so that I can control when tickets become available and when draws occur.

#### Acceptance Criteria

1. THE Platform SHALL support four Raffle states: Draft, Active, Finished, and Cancelled
2. WHEN an Administrator creates a Raffle, THE Platform SHALL set the initial state to Draft
3. WHEN an Administrator activates a Draft Raffle, THE Cloud_Functions SHALL transition the Raffle state to Active
4. WHEN an Administrator finishes an Active Raffle, THE Cloud_Functions SHALL transition the Raffle state to Finished
5. WHEN an Administrator cancels a Draft or Active Raffle, THE Cloud_Functions SHALL transition the Raffle state to Cancelled
6. IF a Raffle is in Finished state, THEN THE Cloud_Functions SHALL reject any modification requests to that Raffle except for setting the Winning Number
7. IF a Raffle is in Cancelled state, THEN THE Cloud_Functions SHALL reject any ticket sale requests for that Raffle
8. THE Raffle SHALL store the following fields: Name (maximum 150 characters), Description (maximum 1000 characters), Image, Prize (maximum 200 characters), Start Date, End Date, Draw Date, Lottery, Winning Number, and Status
9. WHEN an Administrator sets the Winning Number on a Finished Raffle, THE Cloud_Functions SHALL identify and mark the matching Ticket as Winner
10. IF an Administrator requests a state transition that is not permitted by the lifecycle (Draft to Finished, Cancelled to Active, Finished to any other state, or Cancelled to any other state), THEN THE Cloud_Functions SHALL reject the request and return an error indicating the transition is invalid
11. IF an Administrator sets the Winning Number on a Finished Raffle and no Ticket matches that number, THEN THE Cloud_Functions SHALL indicate that no winner was found without modifying any Ticket

### Requirement 4: Ticket Management

**User Story:** As an administrator, I want to manage thousands of tickets per raffle, so that I can assign them to vendors and track their sales status.

#### Acceptance Criteria

1. THE Platform SHALL support seven Ticket states: Available, Assigned, Sold, Paid, Installment, Cancelled, and Winner
2. THE Ticket SHALL store the following fields: Number, Status, Customer, Vendor, Sale Date, Value, Payment reference, Installment references, and Pending Balance
3. WHEN a Raffle is created, THE Cloud_Functions SHALL generate the configured number of Tickets with state Available and Pending Balance equal to the Ticket Value
4. WHEN an Administrator assigns a Ticket to a Vendor, THE Cloud_Functions SHALL transition the Ticket state from Available to Assigned
5. WHEN an Administrator assigns a range of Tickets to a Vendor, THE Cloud_Functions SHALL transition all Tickets in the specified range from Available to Assigned in a single batch operation
6. WHEN a Vendor or Administrator registers a sale for a Ticket, THE Cloud_Functions SHALL transition the Ticket state from Assigned to Sold and associate the Customer
7. IF a Ticket is already in Sold, Paid, Installment, or Winner state, THEN THE Cloud_Functions SHALL reject any duplicate sale attempt for that Ticket
8. WHEN the Pending Balance of a Ticket reaches zero, THE Cloud_Functions SHALL automatically transition the Ticket state to Paid
9. IF a sale is attempted on a Ticket belonging to a Finished or Cancelled Raffle, THEN THE Cloud_Functions SHALL reject the sale
10. WHEN an Administrator cancels a Ticket, THE Cloud_Functions SHALL transition the Ticket state to Cancelled only if the current state is Available, Assigned, or Sold
11. IF a cancellation is attempted on a Ticket in Paid or Winner state, THEN THE Cloud_Functions SHALL reject the cancellation

### Requirement 5: Customer Management

**User Story:** As an administrator, I want to manage customer information and view their complete history, so that I can track relationships across all raffles.

#### Acceptance Criteria

1. THE Customer SHALL store the following fields: Name (maximum 100 characters, required), Document (maximum 20 characters, required, unique within Tenant), Phone (maximum 15 characters, required), WhatsApp (maximum 15 characters, optional), Address (maximum 200 characters, optional), and City (maximum 50 characters, optional)
2. WHEN a Customer record is queried, THE Platform SHALL provide the complete history of all raffles participated, all tickets purchased, all payments made, and all installments registered, scoped to the current Tenant
3. THE Cloud_Functions SHALL enforce uniqueness of Customer Document within a Tenant, rejecting any create or update operation that would result in a duplicate Document value
4. WHEN an Administrator or Vendor creates a Customer, THE Cloud_Functions SHALL validate all required fields (Name, Document, Phone) and field length constraints before persisting
5. IF a Customer creation or update would result in a duplicate Document within the Tenant, THEN THE Cloud_Functions SHALL reject the request and return an error indicating the Document already exists

### Requirement 6: Vendor Management and Metrics

**User Story:** As an administrator, I want to track vendor performance with detailed metrics, so that I can evaluate productivity and manage payouts.

#### Acceptance Criteria

1. THE Vendor SHALL store the following fields: Name, Document (government-issued ID number), Phone, WhatsApp, and Status (one of: Active, Inactive, or Suspended)
2. THE Platform SHALL calculate and display the following Vendor metrics: Assigned count (total tickets assigned), Sold count (tickets with confirmed payment), Available count (tickets not yet sold or reserved), Paid count (tickets whose payment has been fully received), Installment count (tickets with partial payment), Cancelled count (tickets returned or voided), Pending count (tickets reserved but not yet paid), Money collected (total currency received from ticket sales), Commission generated (30% of money collected on paid tickets), Commission paid (commission already disbursed to the Vendor), Pending balance to deliver (money collected minus commission paid minus amounts already delivered to administrator), and Ranking (position among Vendors based on sold ticket count)
3. WHEN a Vendor's metrics are requested, THE Cloud_Functions SHALL compute the metrics from the current ticket and payment data for that Vendor and return results within 5 seconds
4. THE Platform SHALL rank Vendors by sold ticket count within each Raffle and across all Raffles, where Vendors with equal sold ticket count share the same rank position
5. IF a Vendor's Status is set to Inactive or Suspended, THEN THE Platform SHALL retain all historical metrics for that Vendor and continue displaying them to the administrator

### Requirement 7: Payment Processing

**User Story:** As an administrator or vendor, I want to register complete payments and installments for tickets, so that I can track financial progress accurately.

#### Acceptance Criteria

1. WHEN a complete payment is registered for a Ticket, THE Cloud_Functions SHALL record the payment amount, payment method, date, and observations, and set the Ticket Pending Balance to zero
2. WHEN an installment is registered for a Ticket, THE Cloud_Functions SHALL reduce the Pending Balance by the installment amount
3. WHEN an installment is registered, THE Cloud_Functions SHALL record the installment amount, payment method, date, and observations in the Ticket payment history
4. THE Cloud_Functions SHALL maintain a complete chronological payment history for each Ticket
5. IF a payment amount exceeds the Pending Balance of a Ticket, THEN THE Cloud_Functions SHALL reject the payment and return a validation error indicating the maximum acceptable amount
6. IF a payment is attempted on a Ticket with a Pending Balance of zero, THEN THE Cloud_Functions SHALL reject the payment and return a validation error indicating the Ticket is already fully paid
7. THE Platform SHALL never delete any financial movement record from the database
8. THE minimum installment amount SHALL be 1 currency unit
9. WHEN the Pending Balance reaches zero after a payment or installment, THE Cloud_Functions SHALL automatically transition the Ticket state to Paid

### Requirement 8: Financial Reversal Through Adjustment Records

**User Story:** As an administrator, I want to reverse incorrect financial entries without deleting data, so that a complete audit trail is maintained.

#### Acceptance Criteria

1. WHEN an Administrator initiates a financial reversal for a transaction, THE Cloud_Functions SHALL create an Adjustment Record with a reversal amount equal to or less than the original transaction amount, offsetting the original transaction's effect on the Ticket Pending Balance
2. THE Adjustment_Record SHALL reference the original transaction, include the reversal amount, a reason with a minimum of 10 and a maximum of 500 characters, the date of creation, and the Administrator who authorized the reversal
3. WHEN an Adjustment Record is created, THE Cloud_Functions SHALL add the reversal amount back to the Ticket Pending Balance associated with the original transaction
4. THE Cloud_Functions SHALL never delete or modify the original financial movement record during a reversal
5. IF the sum of existing reversal amounts for a transaction plus the new reversal amount would exceed the original transaction amount, THEN THE Cloud_Functions SHALL reject the reversal and return an error message indicating the maximum reversible amount remaining
6. IF an Administrator attempts to reverse a transaction that has already been fully reversed, THEN THE Cloud_Functions SHALL reject the request and return an error message indicating the transaction has already been fully reversed

### Requirement 9: Commission Calculation

**User Story:** As a platform operator, I want commissions calculated automatically based on effective payments, so that vendor earnings are accurate and transparent.

#### Acceptance Criteria

1. WHEN a Ticket payment is fully completed (Pending Balance reaches zero), THE Cloud_Functions SHALL calculate the Vendor commission as 30% of the Ticket base price, rounded down to the nearest whole currency unit
2. WHEN a Ticket payment is fully completed (Pending Balance reaches zero), THE Cloud_Functions SHALL calculate the company profit as 70% of the Ticket base price, rounded up to the nearest whole currency unit
3. IF a Ticket is not fully paid (Pending Balance is greater than zero), THEN THE Cloud_Functions SHALL not generate a commission for that Ticket
4. WHEN a financial reversal causes a Ticket's Pending Balance to become greater than zero, THE Cloud_Functions SHALL create an adjustment record that reverses the associated commission and set the commission status to Reversed
5. THE Cloud_Functions SHALL track commission status with the following transitions: Generated (upon full payment), Paid (upon vendor payout), and Reversed (upon financial reversal), where each commission record may only transition from Generated to Paid, from Generated to Reversed, or from Paid to Reversed
6. WHEN a commission is generated, THE Cloud_Functions SHALL record the Ticket identifier, the commission amount, the company profit amount, the generation timestamp, and the commission status as Generated

### Requirement 10: Administrator Dashboard

**User Story:** As an administrator, I want a comprehensive dashboard showing key business metrics, so that I can monitor platform performance at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display the following sales metrics: Daily sales total (based on the administrator's configured timezone), Monthly sales total (based on the administrator's configured timezone), Money collected, and Money pending
2. THE Dashboard SHALL display the following raffle metrics: Active raffles count, Finished raffles count, Tickets sold count, Tickets available count, and Tickets cancelled count
3. THE Dashboard SHALL display the following people metrics: Total vendors count, Total customers count, Top 5 vendors by sales, Top 5 raffles by revenue, and Top 5 customers by purchases
4. THE Dashboard SHALL display the following financial metrics: Commissions paid total, Commissions pending total, Total profit, Profit per raffle, Daily income (based on the administrator's configured timezone), and Monthly income (based on the administrator's configured timezone)
5. WHEN the Dashboard is loaded, THE Platform SHALL retrieve metrics computed by Cloud_Functions using aggregated data and display results within 3 seconds, with data reflecting activity no older than 5 minutes
6. IF the Platform fails to retrieve metrics from Cloud_Functions, THEN THE Dashboard SHALL display an error message indicating data is temporarily unavailable and offer a manual retry option, while preserving any previously loaded metric values on screen
7. WHEN the Dashboard is loaded and no data exists for a given metric section, THE Dashboard SHALL display a zero-value state for count-based metrics and a zero-amount state for monetary metrics

### Requirement 11: Audit Trail

**User Story:** As an administrator, I want all critical operations logged with full context, so that I can trace who did what and when.

#### Acceptance Criteria

1. WHEN a critical operation is performed (create, update, cancel, payment, reversal), THE Cloud_Functions SHALL create an Audit_Trail entry within 5 seconds, associated with the tenant in which the operation occurred
2. THE Audit_Trail entry SHALL include: operation type, entity type and unique identifier affected, user identifier who performed the action, tenant identifier, timestamp in ISO 8601 UTC format, and the originating IP address if provided by the client request
3. THE Audit_Trail SHALL be immutable; entries SHALL never be modified or deleted and SHALL be retained for a minimum of 365 days
4. WHEN an Administrator queries the Audit Trail, THE Platform SHALL return only entries belonging to the Administrator's tenant and SHALL support filtering by operation type, date range, user, and entity, with results paginated at a maximum of 100 entries per page
5. IF the Audit_Trail entry creation fails, THEN THE Cloud_Functions SHALL retry the entry creation up to 3 times and SHALL NOT discard the operation outcome, preserving the audit data for eventual logging
6. WHEN an Administrator queries the Audit Trail, THE Platform SHALL NOT return entries belonging to a different tenant, regardless of filter parameters provided

### Requirement 12: Search and Filtering

**User Story:** As an administrator, I want to search and filter across all entities, so that I can quickly find specific records.

#### Acceptance Criteria

1. THE Platform SHALL provide a global search input that queries across Customers, Tickets, Vendors, and Raffles, matching against name, identifier, and status fields of each entity
2. WHEN a search query of at least 2 characters is submitted, THE Platform SHALL return matching results within 2 seconds for datasets up to 100,000 records, displaying a maximum of 50 results per page
3. THE Platform SHALL support filtering by: status, date range (start date and end date), vendor, customer, city, and lottery
4. WHEN multiple filters are applied simultaneously, THE Platform SHALL combine them using AND logic, returning only records that satisfy all active filter conditions
5. IF a search query or filter combination yields no matching records, THEN THE Platform SHALL display a message indicating that no results were found
6. THE Platform SHALL restrict search and filter results to records belonging to the current administrator's tenant

### Requirement 13: Data Export

**User Story:** As an administrator, I want to export data in Excel and PDF formats, so that I can generate offline reports and share information.

#### Acceptance Criteria

1. WHEN an Administrator requests an Excel export, THE Platform SHALL generate a downloadable .xlsx file containing the currently filtered dataset (up to 100,000 rows) and provide a download link available for at least 15 minutes after generation completes
2. WHEN an Administrator requests a PDF export, THE Platform SHALL generate a downloadable .pdf file containing the currently filtered dataset (up to 10,000 rows), paginated in A4 portrait format with column headers repeated on each page
3. THE Cloud_Functions SHALL generate export files server-side within 300 seconds to handle datasets up to 100,000 records without browser memory limitations
4. WHILE an export is being generated, THE Platform SHALL display a progress indicator to the Administrator
5. IF an export generation fails or exceeds 300 seconds, THEN THE Platform SHALL notify the Administrator with an error message indicating the failure reason and allow the Administrator to retry the export
6. IF the currently filtered dataset contains zero records, THEN THE Platform SHALL display a message indicating no data is available to export and SHALL NOT initiate file generation
7. IF the filtered dataset exceeds the maximum row limit for the requested format, THEN THE Platform SHALL notify the Administrator that the dataset exceeds the export limit and suggest applying additional filters

### Requirement 14: Real-Time Updates

**User Story:** As an administrator or vendor, I want to see data changes in real-time, so that the interface reflects the current state without manual refresh.

#### Acceptance Criteria

1. WHEN a Ticket status changes, THE Platform SHALL reflect the change on all connected clients viewing that Raffle within 5 seconds
2. WHEN a payment is registered, THE Platform SHALL update the affected Ticket's Pending Balance and status on all connected clients within 5 seconds
3. THE Platform SHALL use Firestore real-time listeners for collections where immediate feedback is critical (tickets, payments)
4. THE Platform SHALL use optimistic UI updates via TanStack Query for user-initiated mutations to provide immediate visual feedback
5. IF a Firestore real-time listener disconnects, THEN THE Platform SHALL display a connectivity warning to the user and attempt automatic reconnection
6. IF an optimistic update is rejected by the Cloud_Functions, THEN THE Platform SHALL revert the local state to match the server state and display an error message explaining the rejection reason

### Requirement 15: User Interface Standards

**User Story:** As a user, I want a modern, professional, and responsive interface, so that I can work efficiently across devices.

#### Acceptance Criteria

1. THE Platform SHALL use HeroUI components for all user interface elements
2. THE Platform SHALL support both light and dark color modes with a user-accessible toggle, and SHALL persist the selected preference across browser sessions using client-side storage so that returning users see their last chosen mode
3. THE Platform SHALL be responsive on screen widths from 320px to 2560px such that no horizontal scrollbar appears, no content is clipped or overlapping, and all interactive features remain accessible without requiring a different device
4. THE Platform SHALL render the Largest Contentful Paint (LCP) within 3 seconds on a 10 Mbps connection with 20ms latency
5. THE Platform SHALL implement animations and transitions using Framer Motion with a maximum duration of 400ms per transition
6. IF the user has enabled a reduced-motion preference in their operating system, THEN THE Platform SHALL disable or minimize all non-essential animations
7. THE Platform SHALL use Lucide React for all iconography

### Requirement 16: Authentication and Session Management

**User Story:** As a user, I want to securely log in and have my session managed, so that my data is protected and I stay logged in across sessions.

#### Acceptance Criteria

1. THE Platform SHALL use Firebase Authentication for all user authentication
2. WHEN a user provides valid credentials, THE Platform SHALL establish an authenticated session and redirect Administrators to the Administrator dashboard and Vendors to the Vendor dashboard within 3 seconds
3. IF a user provides invalid credentials, THEN THE Platform SHALL display a generic error message indicating that the email or password is incorrect without revealing which specific field was wrong
4. IF a user fails to provide valid credentials 5 consecutive times for the same account, THEN THE Platform SHALL temporarily lock the account for 15 minutes and display a message indicating the account has been locked
5. WHEN a user session expires after 60 minutes of inactivity, THE Platform SHALL redirect to the login page and preserve the intended destination URL so the user is redirected back after re-authentication
6. THE Platform SHALL persist authenticated sessions across browser restarts for up to 30 days using Firebase Auth session management, requiring re-authentication only after the persistence period expires or the user explicitly logs out

### Requirement 17: Form Validation

**User Story:** As a user, I want immediate feedback on form inputs, so that I can correct errors before submission.

#### Acceptance Criteria

1. THE Platform SHALL validate all forms using Zod schemas and React Hook Form
2. WHEN a user leaves a required or constrained form field (on blur), THE Platform SHALL validate that field against its Zod schema and display a field-level error message within 200 milliseconds if validation fails
3. WHEN a user submits a form with invalid data, THE Platform SHALL display all field-level error messages without page reload and retain all user-entered data in the form fields
4. THE Cloud_Functions SHALL independently validate all incoming data against server-side validation rules regardless of frontend validation
5. IF the Cloud_Functions validation rejects data that passed frontend validation, THEN THE Platform SHALL display the server-side error message to the user adjacent to the relevant field and retain all user-entered form data
6. IF the Cloud_Functions validation rejects data, THEN THE Cloud_Functions SHALL return an error response that identifies which fields failed validation and the reason for each failure

### Requirement 18: Vendor Self-Service Portal

**User Story:** As a vendor, I want to view my own performance data and register payments, so that I can manage my work independently.

#### Acceptance Criteria

1. WHEN a Vendor authenticates, THE Platform SHALL display only the Vendor's assigned tickets and their statuses (Available, Sold, Pending, Paid, Installment, Cancelled), paginated at a maximum of 50 tickets per page
2. WHEN a Vendor accesses the self-service portal, THE Platform SHALL display the Vendor's financial summary: total money collected, total commission earned, commission paid, and pending balance to deliver to the company, where pending balance equals total money collected minus total commission earned minus amounts already delivered to the company
3. WHEN a Vendor registers a payment or installment, THE Cloud_Functions SHALL validate that the Vendor is authorized for that Ticket and that the Ticket is in a state that accepts payments (Sold, Pending, or Installment) before processing the registration
4. IF a Vendor attempts to register a payment for a Ticket they are not authorized for or a Ticket in a non-payable state (Available, Paid, or Cancelled), THEN THE Cloud_Functions SHALL reject the operation, display an error message indicating the reason for rejection, and preserve the Ticket's current state unchanged
5. THE Platform SHALL prevent a Vendor from viewing or modifying tickets assigned to other Vendors by enforcing data isolation at the query level so that no request returns data belonging to another Vendor

### Requirement 19: Raffle Ticket Number Uniqueness

**User Story:** As a platform operator, I want to guarantee that each ticket number within a raffle is unique and can only be sold once, so that no disputes arise from duplicate sales.

#### Acceptance Criteria

1. THE Cloud_Functions SHALL enforce that each Ticket Number within a Raffle is unique, rejecting any sale request that references a Ticket Number already marked as sold
2. IF a concurrent sale attempt targets the same Ticket, THEN THE Cloud_Functions SHALL use a Firestore transaction to guarantee only one sale succeeds and return a failure response to all other concurrent attempts within 5 seconds
3. WHEN a sale attempt fails due to concurrency or duplicate purchase, THE Platform SHALL notify the user that the Ticket is no longer available and preserve any user-entered data so the user can select a different Ticket without re-entering information
4. IF a sale request references a Ticket Number that does not exist within the Raffle's configured range of 1 to the Raffle's total ticket count (maximum 50,000), THEN THE Cloud_Functions SHALL reject the request with an error indicating an invalid Ticket Number

### Requirement 20: Scalability

**User Story:** As a platform operator, I want the system to handle thousands of simultaneous raffles with thousands of tickets each, so that the platform can grow without performance degradation.

#### Acceptance Criteria

1. THE Firestore data model SHALL support queries across up to 10,000 active Raffles per Tenant, returning results within 2 seconds without requiring full collection scans
2. THE Cloud_Functions SHALL process ticket operations with a response time under 3 seconds for Raffles containing up to 50,000 Tickets, supporting up to 100 concurrent ticket operations per Raffle
3. THE Platform SHALL paginate all list views to retrieve no more than 100 records per request
4. THE Firestore SHALL use composite indexes for the following query patterns: tickets filtered by raffle and status, and payments filtered by date range
5. IF a Cloud_Function request exceeds the 3-second response time threshold, THEN THE Platform SHALL return an error indication to the caller and preserve the pre-operation state of the affected data
