# AcadPro Architecture

## Roles
- super_admin
- academy_owner
- coach
- parent

## Current Modules

- Authentication
- RBAC
- Academies
- Centers
- Batches
- Players
- Coaches
- Coach Batch Mapping
- Attendance
- Attendance History
- Subscription Plans
- Player Subscriptions
- Payment Dues
- Payment Collections

### Attendance Module
✓ CRUD
✓ History
✓ Edit
✓ Soft Delete
✓ Duplicate Prevention
✓ Role Security
✓ Service Layer

### Payment Dues
✓ Due Generation
✓ Remaining Amount Calculation
✓ Partial Payment Support
✓ Full Payment Support

### Payment Collections
✓ Payment History
✓ Receipt Generation
✓ Printable Receipts
✓ Sequential Receipt Numbers
✓ Multi-level Filters

## Folder Structure
src/
  components/
  pages/
  routes/
services/
  - attendanceService.js
  - paymentDueService.js
  - paymentCollectionService.js
  utils/
   - auth.js
   - permissions.js
   - dataScope.js
   - constants.js
   - messages.js

## Important Rules

### Super Admin
- Can see all academies
- Can filter by academy
- Can create academy
- Can see all data

### Academy Owner
- Can only see own academy data

### Coach
- Can only see assigned batches

## Shared Utilities

### Authentication
- auth.js
- Role Detection
- Logged-in User Helper

### Permissions
- permissions.js
- Centralized Role Checks

### Data Scope
- dataScope.js
- Academy Filtering
- Center Filtering
- Batch Filtering
- Player Filtering

### Services
- attendanceService.js
- paymentDueService.js
- paymentCollectionService.js

Business logic is kept inside the service layer while UI components remain focused on rendering and user interaction.

## Tables

- users
- academies
- centers
- batches
- players
- player_batches
- coaches
- coach_batch_mapping
- attendance
- attendance_history
- subscription_plans
- player_subscriptions
- payment_dues
- payments

### Players Module V4

Features:

* Player CRUD
* Parent CRUD Integration
* Academy Filtering
* Center Filtering
* Batch Filtering
* Search
* Role Based Visibility
* Soft Delete (is_active)
* Age Calculation from DOB

Tables Used:

* players
* parents
* academies
* centers
* batches
* player_batches


## Financial Module

### Payment Dues

Purpose

Track all outstanding subscription dues for players.

Features

- Manual Due Generation
- Duplicate Prevention
- Pending / Partial / Paid Status
- Remaining Amount Calculation
- Multi-level Filtering
- Role Based Visibility

Technical Notes

remaining_amount is a PostgreSQL generated column.

Formula

remaining_amount = total_amount - paid_amount

The frontend never updates remaining_amount directly.

Only paid_amount is updated.

The database automatically recalculates remaining_amount.

---

### Payment Collections

Purpose

Record player payments against outstanding dues.

Features

- Partial Payments
- Full Payments
- Overpayment Validation
- Payment History
- Sequential Receipt Numbers
- Printable Receipt
- Receipt Modal
- Transaction Reference
- Payment Mode Tracking

Future Enhancements

- Download PDF
- Email Receipt
- Razorpay Integration


## Architecture Principles

AcadPro follows a layered architecture.

UI Layer
↓

Service Layer

↓

Supabase Database

↓

PostgreSQL

Business logic is placed inside the service layer.

Role validation is centralized through permissions.js.

Data filtering is centralized through dataScope.js.

Generated database columns are never updated directly from the frontend.

This architecture minimizes duplicate code and keeps business rules consistent across modules.