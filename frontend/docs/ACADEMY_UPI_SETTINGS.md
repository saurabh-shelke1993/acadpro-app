# P1.2 — Academy UPI Settings

**Status:** Implemented; automated validation and browser role checks pending  
**Branch:** `payment-module-finalization`  
**Scope:** Academy-owned UPI ID / QR configuration and read-only parent display

## Approved behavior

- Each academy has at most one row in `public.academy_payment_settings`.
- Academy Owners can create/update only their own academy's settings.
- Super Admin can view settings across academies but cannot edit them.
- Parents can read only enabled settings for academies associated with their linked children.
- Coaches and anonymous users have no database access.
- QR images are public-read so a parent can load the image without a signed URL. Upload, replacement and deletion are restricted to the Academy Owner whose academy UUID is the first object-path segment.
- QR images are PNG/JPEG/WebP, at most 2 MiB, and stored as `<academy-uuid>/<random-filename>.<extension>`.
- A replacement QR is uploaded first; the setting row is saved next; only then is the previous image removed. If cleanup fails, the settings save remains successful and the UI reports a warning.
- Enabling settings requires a nonblank payee name and either a valid UPI ID or a QR image.
- Disabling settings hides payment details from parents without deleting the settings.
- No delete operation is exposed for the settings row.

## Database and Storage

### Table: `public.academy_payment_settings`

- `academy_id`: primary key and FK to `public.academies(id)`
- `upi_id`: optional UPI ID, format-checked
- `payee_name`: optional while disabled; required while enabled
- `qr_image_path`: optional object path constrained to the same academy UUID and image extension
- `is_enabled`: defaults to false
- `updated_by`: optional FK to `public.users(id)`
- `created_at`, `updated_at`: timestamps; update trigger maintains `updated_at`

RLS is enabled. Client table grants are limited to authenticated SELECT/INSERT/UPDATE; no anon or DELETE grants. Row policies scope owner mutations and Super Admin/Parent reads.

### Storage bucket: `academy-upi-qr`

- Public read; no anonymous upload or mutation.
- Authenticated mutations require the Academy Owner role and the current academy UUID as the first path segment.
- Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`.
- Maximum file size: 2 MiB.

## Frontend

- Route: `/academy-upi-settings`, protected for Super Admin and Academy Owner.
- Sidebar entry: Finance → Academy UPI Settings.
- Academy Owner can configure UPI ID, payee name, QR image and parent visibility.
- Super Admin selects an academy and gets a read-only view.
- Parent Financial Overview displays enabled payment details for the selected linked child only.
- The parent page does not submit payment claims or update dues. The existing payment ledger remains unchanged.

## Migrations and ledger safety

- `20261012013143_academy_upi_settings_foundation.sql` — table, RLS, grants, timestamp trigger, bucket and Storage policies.
- `20261012013320_academy_upi_settings_policy_tuning.sql` — consolidates SELECT scope into one policy and adds the audit FK index.
- Both versions were observed in the live migration ledger. Existing historical migration drift remains untouched; no historical migration was replayed or renamed.

## Automated validation

The service unit tests cover UPI ID normalization/format validation, QR MIME type and size validation, and the QR-optional case.

## Browser acceptance checklist

1. **Academy Owner — configure:** set payee name and UPI ID, enable, save; reload and confirm values persist.
2. **Academy Owner — QR upload:** upload a PNG/JPEG/WebP under 2 MiB; confirm preview and persisted QR after reload.
3. **Validation:** attempt enabling with blank payee name or no UPI ID/QR; save must be blocked with a useful message.
4. **File validation:** SVG, GIF, and image over 2 MiB must be rejected before upload.
5. **Replacement:** upload a new QR; confirm new QR displays after save and old QR is removed only after successful settings update.
6. **Disabled settings:** turn off parent visibility; parent must no longer see the UPI section.
7. **Parent linked child:** enabled settings appear only for the selected linked child's academy.
8. **Multiple children / academies:** switching child changes the payment details to that child's academy.
9. **Cross-tenant owner:** directly attempting to query/update another academy's row or upload/delete an object under another academy UUID must be denied by RLS/Storage policies.
10. **Super Admin:** can inspect any academy's settings but cannot update settings or mutate QR objects.
11. **Coach and anonymous:** cannot read the settings table or upload/delete QR objects. Public QR image download is expected because public-read is intentional.
12. **Financial integrity:** viewing UPI details must not change `payment_dues`, `payments`, receipts, or payment status.

## Explicitly deferred

- UPI payment submission and UTR capture
- Owner verification workflow for submissions
- Automatic payment status changes
- WhatsApp API
- Razorpay credentials, orders, webhooks or automatic confirmation
