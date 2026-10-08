-- Supabase advisor 0011: pin search_path of the RLS context helpers (they only use pg_catalog).
ALTER FUNCTION waas_tenant() SET search_path = '';
ALTER FUNCTION waas_user() SET search_path = '';
ALTER FUNCTION waas_scope() SET search_path = '';
