-- P1.2 follow-up: keep the SELECT authorization model in one policy and index the audit FK.
DROP POLICY IF EXISTS academy_payment_settings_select_owner_or_super_admin
  ON public.academy_payment_settings;
DROP POLICY IF EXISTS academy_payment_settings_select_linked_parent
  ON public.academy_payment_settings;

CREATE POLICY academy_payment_settings_select_scoped
  ON public.academy_payment_settings
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT private.is_academy_owner())
      AND academy_id = (SELECT private.current_academy_id())
    )
    OR (SELECT private.is_super_admin())
    OR (
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
    )
  );

CREATE INDEX IF NOT EXISTS academy_payment_settings_updated_by_idx
  ON public.academy_payment_settings (updated_by);
