# AcadPro - Project Status

Last Updated: 26-Jun-2026

---

# Project Overview

AcadPro is a multi-tenant Football Academy Management SaaS built using:

- React
- Supabase
- Role Based Access Control (RBAC)
- Git
- Vercel (Deployment later)

Development approach:
- Feature-by-feature development
- Test every module before moving ahead
- Maintain RBAC consistency across all roles

---

# Current Development Phase

🚧 Coach RBAC & Dashboard Enhancements

---

# Completed Modules

## Authentication

- Login
- Logout
- Protected Routes
- Dev Toolbar
- Session Management

---

## Role Based Access Control (RBAC)

### Super Admin

- Complete

### Academy Owner

- Complete

### Coach

Completed

- Login
- Dashboard
- Sidebar
- Coach Attendance
- Coach Attendance History
- Attendance Save

Pending Improvements

- Dashboard Center column
- Restrict Attendance History to assigned batches only
- Better duplicate attendance message

### Parent

Not Started

---

# Academy Management

## Academies

- Create
- Edit
- Update
- Deactivate

## Centers

- CRUD
- Academy Mapping

## Batches

- CRUD
- Center Mapping
- Academy Mapping

---

# Player Management (Players V4)

Completed

- Create Player
- Edit Player
- Update Player
- Deactivate Player
- Parent Creation
- Parent Mapping
- Academy Filter
- Center Filter
- Batch Filter
- Search
- Age Calculation
- Active Status
- Multi Tenant Filtering

RBAC

- Super Admin
- Academy Owner

---

# Attendance Module

Completed

- Mark Attendance
- Attendance History
- Duplicate Attendance Prevention
- Batch Filtering
- Academy Filtering
- Date Filtering

---

# Coaches Module

Completed

- Coach CRUD
- Coach Batch Assignment
- Active / Inactive
- Academy Filtering

Database Table Used

coach_batch_assignments

---

# Coach Dashboard

Completed

- Welcome Screen
- Assigned Batches

Pending

- Show Center beside Batch

---

# Coach Attendance

Completed

- Load Assigned Batches
- Load Players
- Save Attendance
- Duplicate Attendance Prevention
- Attendance saved by Coach Login

Pending

- Friendly duplicate attendance message
- Disable attendance if already marked

---

# Coach Attendance History

Completed

- Attendance List
- Academy Filter
- Batch Filter
- Date Filter

Pending

- Restrict to assigned batches only
- UI improvements

---

# Subscription Plans

Completed

- CRUD
- Active Status
- Plan Types

---

# Player Subscriptions V2

Completed

- Assign Subscription
- Edit Subscription
- Deactivate Subscription
- Duplicate Prevention
- Academy Filter
- Center Filter
- Batch Filter

---

# Payment Dues (V1.4)

Completed

Features

- Academy Filter
- Center Filter
- Batch Filter
- Player Filter
- Subscription Filter
- Due Type
- Due Date
- Generate Due
- Duplicate Due Prevention
- Remaining Amount
- Partial Payment
- Pending Status
- Paid Status
- Edit Due
- Delete Due
- Record Payment

RBAC

Super Admin

- Academy Column
- Center Column

Academy Owner

- Center Column
- Academy Column Hidden

---

# Payment Collections (V1.3)

Completed

Collection Form

- Academy
- Center
- Batch
- Player
- Pending Due
- Amount
- Payment Mode
- Transaction Reference

History

Super Admin

Academy | Center | Batch | Player | Amount | Payment Mode | Reference | Date

Academy Owner

Center | Batch | Player | Amount | Payment Mode | Reference | Date

---

# Database Tables

Primary Tables

- academies
- centers
- batches
- players
- parents
- coaches
- coach_batch_assignments
- subscription_plans
- player_subscriptions
- payment_dues
- payments
- attendance

---

# Git Branch

Current Branch

attendance-history-module-v1

---

# Next Immediate Tasks

## Coach Module

- Dashboard → Show Center
- Attendance History RBAC cleanup
- Better duplicate attendance message
- Disable attendance after already marked

---

# Upcoming Modules

1. Parent Portal
2. Dashboard Improvements
3. Reports & Analytics
4. Razorpay Integration
5. WhatsApp Notifications
6. Deployment (Vercel)
7. Production Testing

---

# Tech Stack

Frontend

- React

Backend

- Supabase

Version Control

- Git

Deployment

- Vercel

---

# Development Guidelines

- Continue feature-by-feature development.
- Test every feature before moving to the next.
- Preserve RBAC across all roles.
- Keep code beginner-friendly.
- Prefer complete code snippets with exact file locations.
- Maintain consistent project architecture.