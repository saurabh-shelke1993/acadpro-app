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
  utils/

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

## Tables
- academies
- centers
- batches
- players
- attendance
- coaches
- coach_batch_mapping
