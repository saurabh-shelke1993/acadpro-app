alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "service_role";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "service_role";

create table "public"."academies" (
  "id"           uuid                     not null default gen_random_uuid(),
  "academy_name" text                     not null,
  "academy_logo" text,
  "owner_name"   text                     not null,
  "email"        text,
  "phone"        text,
  "address"      text,
  "city"         text,
  "state"        text,
  "is_active"    boolean                  default true,
  "created_at"   timestamp with time zone default now(),
  "updated_at"   timestamp with time zone default now(),
  constraint "academies_pkey" primary key (id)
);

create table "public"."attendance" (
  "id"              uuid                        not null default gen_random_uuid(),
  "academy_id"      uuid,
  "player_id"       uuid,
  "batch_id"        uuid,
  "attendance_date" date                        not null,
  "status"          text                        default 'present'::text,
  "marked_by"       uuid,
  "remarks"         text,
  "created_at"      timestamp with time zone    default now(),
  "center_id"       uuid,
  "is_deleted"      boolean                     default false,
  "deleted_at"      timestamp without time zone,
  "deleted_by"      uuid,
  constraint "attendance_pkey" primary key (id),
  constraint "unique_attendance" unique (player_id, batch_id, attendance_date),
  constraint "unique_player_attendance" unique (player_id, batch_id, attendance_date)
);

create table "public"."batches" (
  "id"         uuid                     not null default gen_random_uuid(),
  "academy_id" uuid,
  "center_id"  uuid,
  "batch_name" text                     not null,
  "start_time" time without time zone,
  "end_time"   time without time zone,
  "age_group"  text,
  "is_active"  boolean                  default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "batch_type" text                     default 'Regular'::text,
  constraint "batches_pkey" primary key (id),
  constraint "unique_center_batch" unique (center_id, batch_name)
);

create table "public"."centers" (
  "id"          uuid                     not null default gen_random_uuid(),
  "academy_id"  uuid,
  "center_name" text                     not null,
  "address"     text,
  "city"        text,
  "is_active"   boolean                  default true,
  "created_at"  timestamp with time zone default now(),
  "updated_at"  timestamp with time zone default now(),
  constraint "centers_pkey" primary key (id)
);

create table "public"."coach_batch_assignments" (
  "id"         uuid                     not null default gen_random_uuid(),
  "coach_id"   uuid                     not null,
  "batch_id"   uuid                     not null,
  "academy_id" uuid                     not null,
  "is_active"  boolean                  default true,
  "created_at" timestamp with time zone default now(),
  constraint "coach_batch_assignments_pkey" primary key (id)
);

create table "public"."coach_batches" (
  "id"         uuid                     not null default gen_random_uuid(),
  "coach_id"   uuid,
  "batch_id"   uuid,
  "created_at" timestamp with time zone default now(),
  constraint "coach_batches_pkey" primary key (id)
);

create table "public"."coaches" (
  "id"               uuid                     not null default gen_random_uuid(),
  "academy_id"       uuid,
  "full_name"        text                     not null,
  "email"            text,
  "phone"            text,
  "profile_image"    text,
  "is_active"        boolean                  default true,
  "created_at"       timestamp with time zone default now(),
  "updated_at"       timestamp with time zone default now(),
  "experience_years" integer,
  "joining_date"     date,
  "salary"           numeric,
  "notes"            text,
  "user_id"          uuid,
  "specialization"   text,
  constraint "coaches_pkey" primary key (id)
);

create table "public"."inquiries" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "academy_id"         uuid,
  "parent_name"        text                     not null,
  "player_name"        text                     not null,
  "phone"              text                     not null,
  "dob"                date,
  "inquiry_source"     text,
  "assigned_center_id" uuid,
  "assigned_batch_id"  uuid,
  "trial_status"       text                     default 'pending'::text,
  "notes"              text,
  "created_at"         timestamp with time zone default now(),
  constraint "inquiries_pkey" primary key (id)
);

create table "public"."parents" (
  "id"          uuid                     not null default gen_random_uuid(),
  "academy_id"  uuid,
  "parent_name" text                     not null,
  "email"       text,
  "phone"       text                     not null,
  "address"     text,
  "is_active"   boolean                  default true,
  "created_at"  timestamp with time zone default now(),
  "updated_at"  timestamp with time zone default now(),
  constraint "parents_pkey" primary key (id)
);

create table "public"."payment_dues" (
  "id"              uuid                     not null default gen_random_uuid(),
  "player_id"       uuid,
  "subscription_id" uuid,
  "due_type"        text                     not null,
  "due_date"        date                     not null,
  "total_amount"    numeric(10,2)            not null,
  "paid_amount"     numeric(10,2)            default 0,
  "due_status"      text                     default 'pending'::text,
  "remarks"         text,
  "created_at"      timestamp with time zone default now(),
  "updated_at"      timestamp with time zone default now(),
  constraint "payment_dues_pkey" primary key (id)
);

create table "public"."payments" (
  "id"                    uuid                     not null default gen_random_uuid(),
  "due_id"                uuid,
  "player_id"             uuid,
  "payment_date"          timestamp with time zone default now(),
  "amount_paid"           numeric(10,2)            not null,
  "payment_mode"          text,
  "transaction_reference" text,
  "collected_by"          uuid,
  "remarks"               text,
  "created_at"            timestamp with time zone default now(),
  "receipt_number"        text,
  constraint "payments_pkey" primary key (id)
);

create table "public"."player_batches" (
  "id"            uuid                     not null default gen_random_uuid(),
  "player_id"     uuid,
  "batch_id"      uuid,
  "assigned_date" date                     default CURRENT_DATE,
  "created_at"    timestamp with time zone default now(),
  constraint "player_batches_pkey" primary key (id)
);

create table "public"."player_subscriptions" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "player_id"            uuid,
  "subscription_plan_id" uuid,
  "start_date"           date                     not null,
  "end_date"             date,
  "status"               text                     default 'active'::text,
  "created_at"           timestamp with time zone default now(),
  "updated_at"           timestamp with time zone default now(),
  constraint "player_subscriptions_pkey" primary key (id)
);

create table "public"."players" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "academy_id"          uuid,
  "parent_id"           uuid,
  "full_name"           text                     not null,
  "dob"                 date,
  "gender"              text,
  "profile_image"       text,
  "registration_number" text,
  "joining_date"        date                     default CURRENT_DATE,
  "player_status"       text                     default 'active'::text,
  "medical_notes"       text,
  "is_active"           boolean                  default true,
  "created_at"          timestamp with time zone default now(),
  "updated_at"          timestamp with time zone default now(),
  "center_id"           uuid,
  "batch_id"            uuid,
  "phone"               text,
  "player_code"         text,
  constraint "players_pkey" primary key (id)
);

create table "public"."subscription_plans" (
  "id"               uuid                     not null default gen_random_uuid(),
  "academy_id"       uuid,
  "plan_name"        text                     not null,
  "billing_cycle"    text                     not null,
  "amount"           numeric(10,2)            not null,
  "registration_fee" numeric(10,2)            default 0,
  "description"      text,
  "is_active"        boolean                  default true,
  "created_at"       timestamp with time zone default now(),
  "updated_at"       timestamp with time zone default now(),
  "center_id"        uuid,
  "plan_type"        text,
  constraint "subscription_plans_pkey" primary key (id)
);

create table "public"."trial_attendance" (
  "id"         uuid                     not null default gen_random_uuid(),
  "inquiry_id" uuid,
  "trial_date" date                     not null,
  "attended"   boolean                  default false,
  "remarks"    text,
  "created_at" timestamp with time zone default now(),
  constraint "trial_attendance_pkey" primary key (id)
);

create table "public"."users" (
  "id"         uuid                     not null,
  "full_name"  text                     not null,
  "email"      text                     not null,
  "role"       text                     not null,
  "academy_id" uuid,
  "created_at" timestamp with time zone default now(),
  constraint "users_email_key" unique (email),
  constraint "users_pkey" primary key (id)
);

alter table "public"."payment_dues"
  add column "remaining_amount" numeric(10,2) generated always as ((total_amount - paid_amount)) stored;

alter table "public"."attendance"
  add constraint "attendance_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."batches"
  add constraint "batches_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."attendance"
  add constraint "attendance_batch_id_fkey" foreign key (batch_id) references public.batches(id) on delete cascade;

alter table "public"."centers"
  add constraint "centers_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."batches"
  add constraint "batches_center_id_fkey" foreign key (center_id) references public.centers(id) on delete cascade;

alter table "public"."coach_batch_assignments"
  add constraint "coach_batch_assignments_academy_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."coach_batch_assignments"
  add constraint "coach_batch_assignments_batch_fkey" foreign key (batch_id) references public.batches(id) on delete cascade;

alter table "public"."coach_batches"
  add constraint "coach_batches_batch_id_fkey" foreign key (batch_id) references public.batches(id) on delete cascade;

alter table "public"."coaches"
  add constraint "coaches_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."coach_batch_assignments"
  add constraint "coach_batch_assignments_coach_fkey" foreign key (coach_id) references public.coaches(id) on delete cascade;

alter table "public"."coach_batches"
  add constraint "coach_batches_coach_id_fkey" foreign key (coach_id) references public.coaches(id) on delete cascade;

alter table "public"."coaches"
  add constraint "coaches_user_id_fkey" foreign key (user_id) references auth.users(id) on delete set null;

alter table "public"."inquiries"
  add constraint "inquiries_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."inquiries"
  add constraint "inquiries_assigned_batch_id_fkey" foreign key (assigned_batch_id) references public.batches(id) on delete set null;

alter table "public"."inquiries"
  add constraint "inquiries_assigned_center_id_fkey" foreign key (assigned_center_id) references public.centers(id) on delete set null;

alter table "public"."parents"
  add constraint "parents_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."payments"
  add constraint "payments_collected_by_fkey" foreign key (collected_by) references public.coaches(id) on delete set null;

alter table "public"."payments"
  add constraint "payments_due_id_fkey" foreign key (due_id) references public.payment_dues(id) on delete cascade;

alter table "public"."player_batches"
  add constraint "player_batches_batch_id_fkey" foreign key (batch_id) references public.batches(id) on delete cascade;

alter table "public"."payment_dues"
  add constraint "payment_dues_subscription_id_fkey" foreign key (subscription_id) references public.player_subscriptions(id) on delete cascade;

alter table "public"."players"
  add constraint "players_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."players"
  add constraint "players_batch_id_fkey" foreign key (batch_id) references public.batches(id) on delete set null;

alter table "public"."players"
  add constraint "players_center_id_fkey" foreign key (center_id) references public.centers(id) on delete set null;

alter table "public"."players"
  add constraint "players_parent_id_fkey" foreign key (parent_id) references public.parents(id) on delete set null;

alter table "public"."attendance"
  add constraint "attendance_player_id_fkey" foreign key (player_id) references public.players(id) on delete cascade;

alter table "public"."payment_dues"
  add constraint "payment_dues_player_id_fkey" foreign key (player_id) references public.players(id) on delete cascade;

alter table "public"."payments"
  add constraint "payments_player_id_fkey" foreign key (player_id) references public.players(id) on delete cascade;

alter table "public"."player_batches"
  add constraint "player_batches_player_id_fkey" foreign key (player_id) references public.players(id) on delete cascade;

alter table "public"."player_subscriptions"
  add constraint "player_subscriptions_player_id_fkey" foreign key (player_id) references public.players(id) on delete cascade;

alter table "public"."subscription_plans"
  add constraint "subscription_plans_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete cascade;

alter table "public"."subscription_plans"
  add constraint "subscription_plans_center_id_fkey" foreign key (center_id) references public.centers(id);

alter table "public"."player_subscriptions"
  add constraint "player_subscriptions_subscription_plan_id_fkey" foreign key (subscription_plan_id) references public.subscription_plans(id) on delete set null;

alter table "public"."trial_attendance"
  add constraint "trial_attendance_inquiry_id_fkey" foreign key (inquiry_id) references public.inquiries(id) on delete cascade;

alter table "public"."users"
  add constraint "users_academy_id_fkey" foreign key (academy_id) references public.academies(id) on delete set null;

alter table "public"."users"
  add constraint "users_id_fkey" foreign key (id) references auth.users(id) on delete cascade;

alter table "public"."attendance"
  add constraint "attendance_deleted_by_fkey" foreign key (deleted_by) references public.users(id);

alter table "public"."attendance"
  add constraint "attendance_marked_by_fkey" foreign key (marked_by) references public.users(id) on delete set null;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."academies" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."attendance" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."batches" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."centers" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."coach_batch_assignments" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."coach_batches" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."coaches" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."inquiries" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."parents" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."payment_dues" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."payments" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."player_batches" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."player_subscriptions" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."players" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."subscription_plans" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."trial_attendance" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."users" to "anon", "authenticated", "postgres", "service_role";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "anon";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "authenticated";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "anon";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "authenticated";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "service_role";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "anon";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "authenticated";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";
