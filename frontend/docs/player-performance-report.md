# Player Performance Report

## Overview

The Player Performance feature allows authorized users to view player skill assessments and allows coaches to create and maintain assessments for players in their assigned batches.

The reporting interface is read-only. Assessment creation and editing are handled separately through the coach assessment-entry page.

## Routes

### Coach assessment entry

```text
/coach-performance-assessments
```

## Player Data Integrity Dependency

Player Performance must use the current player/batch relationship as the authoritative operational scope.

The Player module hardening completed before Player Performance implementation establishes:

- Active players with a current `players.batch_id` have exactly one matching `player_batches` mapping.
- Active players without a current batch have no `player_batches` mapping.
- Duplicate current player-batch mappings are prevented at the database layer.
- Player create/update operations use transactional database functions.
- Coach access remains constrained to assigned batches and their players.

This ensures that performance assessment visibility can be built on a consistent player/batch scope rather than relying on potentially inconsistent frontend mappings.

## Implementation Status

- Player Performance reporting foundation exists.
- Coach assessment entry exists at `/coach-performance-assessments`.
- Live RLS policies exist for Super Admin, Academy Owner, Coach and Parent access.
- Parent report visibility is linked to the parent's current linked players.
- Player Performance V1 implementation is now aligned with the confirmed business rules; functional and RBAC regression testing remains pending.

## Code Audit — 25 September 2026

### Current implementation

- `PlayerPerformanceReport.js` is read-only and supports Super Admin, Academy Owner, Coach and Parent player selection.
- `CoachPerformanceAssessments.js` supports Coach, Academy Owner and Super Admin assessment management for active players within each role's authorized scope.
- Coach assessment history is filtered to the logged-in coach's own assessments; Academy Owner and Super Admin history is player-scoped across assessments.
- The report page loads all assessments for the selected player, which supports historical player reporting.
- Scores are validated in the UI and the database enforces the 0–10 range.
- Current player/batch integrity hardening provides the authoritative operational scope for coach access.

### Security observations

- Database RLS is the primary authorization boundary for assessment SELECT/INSERT/UPDATE/DELETE.
- Parent assessment access is read-only through RLS; no parent INSERT/UPDATE/DELETE policy exists.
- Coach INSERT/UPDATE/DELETE access requires the coach identity and current assignment relationship.
- Multiple active coaches per batch are compatible with the current `is_coach_assigned_to_batch` authorization model.
- No direct assessment mutation route is exposed to parents.

### Player Performance V1 Specification — Confirmed 25 September 2026

1. **Assessment uniqueness:** Multiple assessments for the same player on the same date are valid. No uniqueness constraint is required for player/coach/date.
2. **Historical visibility:** A coach can view a player's historical assessments when the coach is currently authorized to access that player's current active batch. Historical visibility is player-centric, not creator-centric.
3. **Inactive players/batches:** Inactive players and inactive batches are excluded from normal assessment entry/report selection. Existing assessment records are preserved.
4. **Assessment ownership:** Coaches may edit/delete only their own assessments. Academy Owners and Super Admins may manage assessments within their authorized scope.
5. **Assessment data model:** V1 is frozen at nine 0–10 metrics plus coach remarks.

### Implementation status after V1 decisions

- Coach assessment entry is limited to active players in currently assigned active batches.
- Super Admin and Academy Owner can manage assessments for active players in their authorized scope.
- Coach assessment history is creator-scoped for coach users; owner/admin history is player-scoped across assessments.
- Assessment delete is available and protected by database RLS.
- Multiple same-day assessments remain supported.
- Report player selection excludes inactive players and inactive current batches while preserving historical assessment rows in the database.
- Parent remains read-only through the report route and RLS.

The nine V1 metrics are:

- Ball control
- Passing
- Dribbling
- Shooting
- Defending
- Speed
- Stamina
- Teamwork
- Discipline

No database uniqueness change is required for the confirmed V1 model.
