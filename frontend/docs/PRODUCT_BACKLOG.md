# AcadPro Product Backlog

**Last Updated:** 08 September 2026  
**Current Branch:** `payment-module-finalization`

This backlog reflects the current development order. Security and data isolation are treated as prerequisites for production rather than optional polish.

---

# ✅ Completed

## Authentication & Core Security Foundation

- Login System
- Supabase Authentication
- Role Based Access Control foundation
- Multi-tenant academy model
- Centralized Permission Model
- Centralized Data Scope
- Protected role-aware routes

## Academy Management

- Academy CRUD
- Center CRUD
- Batch CRUD
- Academy Owner batch creation

## Player Management

- Player CRUD
- Parent CRUD
- Player Search
- Player Batch Mapping
- Soft Delete
- Multi Batch Support

## Coach Management

- Coach CRUD
- Coach Batch Assignment

## Attendance

- Mark Attendance
- Edit Attendance
- Attendance History
- Soft Delete
- Duplicate Prevention
- 7-Day Coach Editing Rule
- Attendance Role Security
- Attendance Service Layer

## Subscription Management

- Subscription Plans
- Player Subscriptions

## Payment Module

### Payment Dues

- Due Generation
- Duplicate Due Prevention
- Remaining Amount Calculation
- Pending / Partial / Paid Status
- Due Editing
- Multi-level Filtering

### Payment Collections

- Collect Payment
- Partial Payment
- Full Payment
- Overpayment Validation
- Payment History
- Transaction Reference
- Automatic Remaining Amount
- Automatic Status Update

### Receipt Management

- Sequential Receipt Numbers
- Receipt Modal
- Printable Receipts
- Receipt Management

## Dashboard Analytics

- Dashboard KPI Cards
- Attendance KPI Cards
- Attendance Trend
- Attendance Percentage
- Collections KPI Cards
- Collections Trend
- Currency Formatting
- Analytics Tooltips
- Chart Data Labels
- Empty-State Handling
- Role-Aware Analytics
- Academy Owner Scope
- Coach Batch Scope
- Super Admin Cross-Academy Scope
- Dashboard Analytics Role Verification

## Parent Portal Foundation

- Parent Role
- Parent Authentication
- Parent Login
- Parent Route
- Parent RBAC Protection
- Parent → Player Data Association
- Basic Parent Portal Page

---

# 🔴 HIGH PRIORITY

## 1. Finalize Role Security + RLS Validation

### RBAC validation

- [ ] Final Super Admin validation
- [ ] Final Academy Owner validation
- [ ] Final Coach validation
- [ ] Final Parent validation
- [ ] Route protection validation
- [ ] UI permission vs actual authorization validation

### Data-scope validation

- [ ] Super Admin → all permitted data
- [ ] Academy Owner → own academy only
- [ ] Coach → assigned batches/players only
- [ ] Parent → linked player(s) only
- [ ] Cross-academy leakage testing
- [ ] Cross-parent/player leakage testing

### RLS validation

- [ ] Review all role-sensitive tables
- [ ] Verify SELECT policies
- [ ] Verify INSERT policies
- [ ] Verify UPDATE policies
- [ ] Verify DELETE policies
- [ ] Validate Parent attendance access
- [ ] Validate Coach assignment scope
- [ ] Validate payment data scope
- [ ] Review `inquiries` RLS status
- [ ] Review `trial_attendance` RLS status
- [ ] Review Supabase Security Advisor findings

---

## 2. Parent Portal Completion

### In Progress

- [ ] Parent Dashboard

### Pending

- [ ] Attendance History
- [ ] Payment History
- [ ] Pending Dues
- [ ] Receipt access
- [ ] Receipt download
- [ ] Parent-specific RLS validation
- [ ] Parent end-to-end regression

---

## 3. Player Performance

**Status:** Not started.

Planned capabilities:

- Player performance profile
- Performance metrics
- Player-level analytics
- Historical performance tracking
- Role-aware performance visibility

Detailed functional requirements to be finalized before implementation.

---

## 4. Payment Module Regression

Run complete regression after security validation:

- [ ] Payment Dues
- [ ] Due generation
- [ ] Duplicate prevention
- [ ] Due editing
- [ ] Partial payment
- [ ] Full payment
- [ ] Overpayment validation
- [ ] Remaining amount
- [ ] Status transitions
- [ ] Payment history
- [ ] Receipt generation
- [ ] Receipt numbering
- [ ] Printable receipt
- [ ] Role restrictions
- [ ] Academy/data-scope isolation
- [ ] Negative authorization testing

---

## 5. Automated Payment Reminders

**Status:** Not started.

Planned:

- [ ] Reminder eligibility rules
- [ ] Reminder scheduling
- [ ] Due-date based reminders
- [ ] Parent recipient resolution
- [ ] Notification delivery abstraction
- [ ] Delivery status / failure tracking
- [ ] Duplicate reminder prevention
- [ ] Reminder history

---

## 6. Razorpay Production Flow

**Status:** Not started.

Planned:

- [ ] Razorpay account/configuration
- [ ] Payment order creation
- [ ] Checkout integration
- [ ] Server-side payment verification
- [ ] Success callback
- [ ] Failed payment handling
- [ ] Webhook handling
- [ ] Payment finalization
- [ ] Idempotency / duplicate protection
- [ ] Receipt generation
- [ ] Production credentials
- [ ] Production webhook configuration
- [ ] End-to-end production-like testing

---

# 🟡 MEDIUM PRIORITY

## Dashboard Functional Enhancements

- [ ] Additional operational actions
- [ ] Dashboard UX polish
- [ ] Performance optimization
- [ ] Responsive dashboard refinement

## Notification Infrastructure

- [ ] Notification data model
- [ ] Notification service abstraction
- [ ] Due reminders
- [ ] Attendance notifications
- [ ] Email notifications
- [ ] WhatsApp notifications
- [ ] Push notifications

## Error / Loading Handling

- [ ] Standard loading states
- [ ] Standard empty states
- [ ] Consistent error messages
- [ ] Retry handling
- [ ] Form validation consistency
- [ ] Network/API error handling

## Mobile / Responsive Refinement

- [ ] Responsive navigation
- [ ] Responsive tables
- [ ] Responsive forms
- [ ] Responsive dashboard
- [ ] Tablet support
- [ ] Mobile usability review

---

# 🔵 BEFORE PRODUCTION

## Full QA Regression

- [ ] Authentication
- [ ] RBAC
- [ ] Academy Management
- [ ] Centers
- [ ] Batches
- [ ] Players
- [ ] Coaches
- [ ] Attendance
- [ ] Attendance History
- [ ] Subscriptions
- [ ] Payment Dues
- [ ] Payment Collections
- [ ] Receipts
- [ ] Dashboard
- [ ] Parent Portal
- [ ] Razorpay
- [ ] Notifications

## Production Security Audit

- [ ] RBAC audit
- [ ] RLS audit
- [ ] Cross-academy isolation
- [ ] Parent/player isolation
- [ ] Authentication/session review
- [ ] Environment variable review
- [ ] Supabase Security Advisor
- [ ] Development-only access review

## Remove Development Features

- [ ] Dev Toolbar
- [ ] Dev login
- [ ] Development-only shortcuts
- [ ] Development-only test data/behavior

## Environment / Deployment Hardening

- [ ] Production Supabase configuration
- [ ] Production environment variables
- [ ] Razorpay production credentials
- [ ] Webhook configuration
- [ ] Vercel production configuration
- [ ] Error monitoring
- [ ] Backup/recovery process

## Documentation Synchronization

- [ ] ROLE_MATRIX.md
- [ ] PROJECT_STATUS.md
- [ ] PROJECT_ARCHITECTURE.md
- [ ] PRODUCT_BACKLOG.md

---

# ⚪ FUTURE / LOWER PRIORITY

## Reporting

- Revenue Reports
- Daily Collections
- Monthly Collections
- Yearly Collections
- Pending Dues Reports
- Paid Dues Reports
- Partial Payment Reports
- Outstanding Revenue
- Player Attendance %
- Batch Attendance
- Coach Attendance Summary

## Reports Export

- Export Excel
- Export PDF
- Printable Reports

## Administration

- Audit Logs
- System Settings
- Backup & Restore
- User Activity Logs

## Receipt Enhancements

- Download PDF receipts
- Email receipts

## Future Product Features

- Academy Branding
- QR Code Attendance
- QR Code Receipt
- Digital ID Cards
- Coach Performance Dashboard
- Tournament Management
- Match Scheduling
- Ground Booking
- Inventory Management

---

# Product Vision — V1.0

AcadPro V1.0 aims to provide football academies with a complete operational platform covering:

- Academy Administration
- Center Management
- Batch Management
- Player Management
- Coach Management
- Attendance Management
- Subscription Management
- Payment Management
- Receipt Management
- Dashboard Analytics
- Parent Portal

The immediate roadmap is intentionally focused on security, Parent Portal completion, Player Performance, payment reliability, automated reminders and production-grade online payments before broader feature expansion.
