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
- Player Performance remains a high-priority feature workstream and is now in code/data-model audit before further implementation changes.

## Code Audit — 25 September 2026

### Current implementation

- `PlayerPerformanceReport.js` is read-only and supports Super Admin, Academy Owner, Coach and Parent player selection.
- `CoachPerformanceAssessments.js` allows coaches to create and edit assessments for players in their currently assigned active batches.
- Assessment history in the coach entry page is filtered by both `player_id` and the logged-in coach's `coach_id`.
- The report page loads all assessments for the selected player, which supports historical player reporting.
- Scores are validated in the UI and the database enforces the 0–10 range.
- Current player/batch integrity hardening provides the authoritative operational scope for coach access.

### Security observations

- Database RLS is the primary authorization boundary for assessment SELECT/INSERT/UPDATE/DELETE.
- Parent assessment access is read-only through RLS; no parent INSERT/UPDATE/DELETE policy exists.
- Coach INSERT/UPDATE/DELETE access requires the coach identity and current assignment relationship.
- Multiple active coaches per batch are compatible with the current `is_coach_assigned_to_batch` authorization model.
- No direct assessment mutation route is exposed to parents.

### Decisions / items to resolve before implementation changes

1. **Assessment uniqueness:** the database currently permits multiple assessments for the same player, coach and assessment date. Confirm whether multiple assessments on one date are valid or whether a uniqueness rule is required.
2. **Historical visibility:** current Coach SELECT scope is based on the player's current assigned batch, not the coach who originally created the assessment. Confirm whether a newly assigned coach should see the player's historical assessments.
3. **Inactive players/batches:** the report and coach entry queries do not consistently filter inactive players/batches at the frontend. Confirm the intended behavior before tightening this.
4. **Assessment ownership:** `coach_id` is retained on assessments and is used for coach edit/delete authorization. Confirm whether only the creating coach may edit/delete or whether academy owners/super admins should manage historical assessments.
5. **Assessment data model:** confirm whether the current nine 0–10 skill scores and free-text remarks are the complete V1 metric set before adding more fields.

No Player Performance code changes were made during this audit.
