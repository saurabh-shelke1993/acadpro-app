# Supabase RLS Migration Inventory

## Purpose

This document records the Supabase security migrations applied to the AcadPro
database. The migrations listed here were applied to the Supabase project:

- Project ID: `ulyealhkmlorsbdiknrh`

The migration history was checked on 17 September 2026.

## Migration History

| Migration Version | Migration Name | Purpose |
|---|---|---|
| `20260823093317` | `remote_schema` | Initial remote database schema |
| `20260903173804` | `phase_3_2_assignment_isolation` | Assignment-based data isolation |
| `20260903185104` | `phase_3_4_batch_mutation_security` | Batch mutation security |
| `20260907180752` | `phase_3_5_player_mutation_security` | Player mutation security |
| `20260908061110` | `phase_3_6_attendance_mutation_security` | Attendance mutation security |
| `20260908062059` | `phase_4_1_parent_read_isolation` | Parent read isolation |
| `20260908070804` | `phase_6_3_subscription_security` | Subscription access security |
| `20260908073942` | `phase_7_payment_due_security` | Payment due access security |
| `20260908075043` | `phase_8_2_payment_mutation_security` | Payment mutation security |
| `20260912085524` | `tighten_centers_and_player_batches_rbac` | Strengthened center and player-batch RBAC |
| `20260912142706` | `link_parents_to_auth_users` | Linked parent records to authenticated users |
| `20260912180959` | `allow_parents_to_view_linked_attendance` | Allowed parents to view linked attendance |
| `20260912184118` | `create_player_performance_assessments` | Created player performance assessment storage and RLS |
| `20260912185706` | `limit_performance_assessment_scores_to_ten` | Restricted performance scores to the range 0–10 |
| `20260915111222` | `harden_player_performance_assessment_rls_coach_lookup` | Hardened coach access using the authenticated user's linked coach record |

## Player Performance Assessment RLS

The `player_performance_assessments` table uses role-based access rules.

### Super Admin

- Can read and manage performance assessments across academies.

### Academy Owner

- Can access assessments belonging to the current academy.
- The referenced player must also belong to the current academy.

### Coach

- Can access assessments for players in batches assigned to that coach.
- Assessment mutations require the assessment's `coach_id` to reference a
  coach record linked to the authenticated user.
- The player's batch must be actively assigned to the coach.

### Parent

- Has read-only access to assessments for their linked children.
- Parent access is resolved through the authenticated user's linked record in
  `public.parents`.
- Parents do not receive insert, update, or delete permissions.

## Performance Score Validation

All nine performance skill scores are constrained to the range:

- Minimum: `0`
- Maximum: `10`
- Blank values are allowed and are stored as `NULL`.

The nine score fields are:

- `ball_control_score`
- `passing_score`
- `dribbling_score`
- `shooting_score`
- `defending_score`
- `speed_score`
- `stamina_score`
- `teamwork_score`
- `discipline_score`

## Verification

The performance RLS hardening migration was applied successfully in Supabase.

Manual role validation completed successfully for:

- Super Admin
- Academy Owner
- Coach
- Parent

The migration was documented in this file for source-control traceability.
The SQL should not be re-applied manually because the migration already exists in
the Supabase migration history.