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
- Player Performance feature implementation remains a high-priority pending work item.
- Performance requirements, metrics, historical tracking and role-aware visibility still need to be finalized before full implementation.
