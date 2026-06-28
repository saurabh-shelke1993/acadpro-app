# AcadPro Architecture

## Roles
- super_admin
- academy_owner
- coach
- parent

## Current Modules
- Academies
- Centers
- Batches
- Players
- Attendance
✓ CRUD
✓ History
✓ Edit
✓ Soft Delete
✓ Role Security
✓ Service Layer
- Attendance History
- Coaches
- Coach Batch Mapping
- Subscription Plans
- Payment Dues
- Payment Collections

## Folder Structure
src/
  components/
  pages/
  routes/
  services/
   - attendanceService.js
  utils/
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
- auth.js handles role checks
- Sidebar.js handles role menus
- permissions.js
- Centralized role checks
- attendanceService.js
- Attendance business logic
- dataScope.js
- Centralized data filtering

## Tables
- academies
- centers
- batches
- players
- attendance
- coaches
- coach_batch_mapping

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

Purpose:
Track subscription-based dues for players.

Current Features:
- Manual Due Generation
- Duplicate Prevention
- Pending Status Tracking
- Remaining Amount Calculation

Planned:
- Academy/Center/Batch/Player Filters
- Mark Paid
- Edit Due
- Automated Monthly Due Generation