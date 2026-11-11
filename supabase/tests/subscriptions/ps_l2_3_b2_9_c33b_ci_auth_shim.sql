-- C3.3B CI ONLY, PostgreSQL 17 native-shaped approximation.
-- NOT Supabase Auth, no JWT verification. NEVER execute on real local or hosted Supabase.
-- Separate new test DATABASE; database ROLES preexist from the original B2.9 CI job.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
