-- P1.2 Academy UPI Settings
-- Academy Owners manage their own payment settings. Super Admin is read-only.
-- Parents can read enabled settings only for academies of their linked children.
-- QR images are public-read; writes are owner-scoped by academy UUID path prefix.

CREATE TABLE public.academy_payment_settings (
  academy_id uuid PRIMARY KEY
    REFERENCES public.academies(id) ON DELETE RESTRICT,
  upi_id text,
  payee_name text,
  qr_image_path text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT academy_payment_settings_upi_id_format
    CHECK (
      upi_id IS NULL
      OR (
        length(btrim(upi_id)) BETWEEN 3 AND 100
        AND btrim(upi_id) ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$'
      )
    ),
  CONSTRAINT academy_payment_settings_payee_name_not_blank
    CHECK (payee_name IS NULL OR length(btrim(payee_name)) > 0),
  CONSTRAINT academy_payment_settings_qr_path_scope
    CHECK (
      qr_image_path IS NULL
      OR qr_image_path ~* (
        '^' || academy_id::text || '/[^/]+\.(png|jpe?g|webp)$'
      )
    ),
  CONSTRAINT academy_payment_settings_enabled_method
    CHECK (
      NOT is_enabled
      OR (
        payee_name IS NOT NULL
        AND length(btrim(payee_name)) > 0
        AND (upi_id IS NOT NULL OR qr_image_path IS NOT NULL)
      )
    )
);

CREATE INDEX academy_payment_settings_enabled_idx
  ON public.academy_payment_settings (academy_id)
  WHERE is_enabled = true;

ALTER TABLE public.academy_payment_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.academy_payment_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.academy_payment_settings TO authenticated;
GRANT ALL ON TABLE public.academy_payment_settings TO service_role;

CREATE POLICY academy_payment_settings_select_owner_or_super_admin
  ON public.academy_payment_settings
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT private.is_academy_owner())
      AND academy_id = (SELECT private.current_academy_id())
    )
    OR (SELECT private.is_super_admin())
  );

CREATE POLICY academy_payment_settings_select_linked_parent
  ON public.academy_payment_settings
  FOR SELECT TO authenticated
  USING (
    is_enabled = true
    AND (SELECT private.current_user_role()) = 'parent'
    AND EXISTS (
      SELECT 1
      FROM public.parents AS parent_record
      JOIN public.players AS linked_player
        ON linked_player.parent_id = parent_record.id
      WHERE parent_record.user_id = (SELECT auth.uid())
        AND linked_player.academy_id = academy_payment_settings.academy_id
    )
  );

CREATE POLICY academy_payment_settings_insert_owner
  ON public.academy_payment_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_academy_owner())
    AND academy_id = (SELECT private.current_academy_id())
    AND (updated_by IS NULL OR updated_by = (SELECT auth.uid()))
  );

CREATE POLICY academy_payment_settings_update_owner
  ON public.academy_payment_settings
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_academy_owner())
    AND academy_id = (SELECT private.current_academy_id())
  )
  WITH CHECK (
    (SELECT private.is_academy_owner())
    AND academy_id = (SELECT private.current_academy_id())
    AND (updated_by IS NULL OR updated_by = (SELECT auth.uid()))
  );

CREATE OR REPLACE FUNCTION private.set_academy_payment_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.set_academy_payment_settings_updated_at()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER academy_payment_settings_set_updated_at
  BEFORE UPDATE ON public.academy_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_academy_payment_settings_updated_at();

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'academy-upi-qr',
  'academy-upi-qr',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY academy_upi_qr_public_read
  ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'academy-upi-qr');

CREATE POLICY academy_upi_qr_owner_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'academy-upi-qr'
    AND split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    AND split_part(name, '/', 2) <> ''
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND private.is_academy_owner()
    AND split_part(name, '/', 1) = (SELECT private.current_academy_id())::text
    AND split_part(name, '/', 2) ~* '^[^/]+\.(png|jpe?g|webp)$'
  );

CREATE POLICY academy_upi_qr_owner_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'academy-upi-qr'
    AND split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    AND split_part(name, '/', 2) <> ''
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND private.is_academy_owner()
    AND split_part(name, '/', 1) = (SELECT private.current_academy_id())::text
  )
  WITH CHECK (
    bucket_id = 'academy-upi-qr'
    AND split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    AND split_part(name, '/', 2) <> ''
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND private.is_academy_owner()
    AND split_part(name, '/', 1) = (SELECT private.current_academy_id())::text
    AND split_part(name, '/', 2) ~* '^[^/]+\.(png|jpe?g|webp)$'
  );

CREATE POLICY academy_upi_qr_owner_delete
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'academy-upi-qr'
    AND split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    AND split_part(name, '/', 2) <> ''
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND private.is_academy_owner()
    AND split_part(name, '/', 1) = (SELECT private.current_academy_id())::text
  );
