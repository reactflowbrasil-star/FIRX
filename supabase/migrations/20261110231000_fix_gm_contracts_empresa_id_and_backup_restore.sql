-- 1. Add missing empresa_id column, index, backfill, and tenant/manager RLS to public.gm_contracts.
-- 2. Fix workspace audit triggers so deleting empresas does not violate auditoria_empresa_id_fkey.
-- 3. Fix admin_clear_operational_data (vendedor_visitas RESTRICT FK, marketing_projects pair CHECK,
--    sequence reset) and admin_restore_system_backup (safe remapping of missing auth.users/profiles
--    UUIDs, gm_files_check object_path prefix adjustment, legacy backup compatibility, and
--    gm_contracts_numero_seq synchronization).

-- =============================================================================
-- PART 1: public.gm_contracts.empresa_id + index + backfill + RLS policies
-- =============================================================================

ALTER TABLE public.gm_contracts
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gm_contracts_empresa_id_fkey'
      AND conrelid = 'public.gm_contracts'::regclass
  ) THEN
    ALTER TABLE public.gm_contracts
      ADD CONSTRAINT gm_contracts_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS gm_contracts_empresa_created_idx
  ON public.gm_contracts (empresa_id, created_at DESC);

UPDATE public.gm_contracts AS c
SET empresa_id = (c.payload ->> 'empresa_id')::uuid
WHERE c.empresa_id IS NULL
  AND (c.payload ->> 'empresa_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.empresas AS e
    WHERE e.id = (c.payload ->> 'empresa_id')::uuid
  );

ALTER TABLE public.gm_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gm_contracts_select_own ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_insert_own ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_update_own ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_delete_own ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_platform_admin_all ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_select ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_insert ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_update ON public.gm_contracts;
DROP POLICY IF EXISTS gm_contracts_delete ON public.gm_contracts;

CREATE POLICY gm_contracts_select ON public.gm_contracts
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR user_id = (SELECT auth.uid())
    OR (
      empresa_id IS NOT NULL
      AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
    )
  );

CREATE POLICY gm_contracts_insert ON public.gm_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR (
      user_id = (SELECT auth.uid())
      AND (empresa_id IS NULL OR public.is_empresa_member(empresa_id))
    )
  );

CREATE POLICY gm_contracts_update ON public.gm_contracts
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      user_id = (SELECT auth.uid())
      AND (empresa_id IS NULL OR public.is_empresa_member(empresa_id))
    )
    OR (
      empresa_id IS NOT NULL
      AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      user_id = (SELECT auth.uid())
      AND (empresa_id IS NULL OR public.is_empresa_member(empresa_id))
    )
    OR (
      empresa_id IS NOT NULL
      AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
    )
  );

CREATE POLICY gm_contracts_delete ON public.gm_contracts
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      user_id = (SELECT auth.uid())
      AND (empresa_id IS NULL OR public.is_empresa_member(empresa_id))
    )
    OR (
      empresa_id IS NOT NULL
      AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
    )
  );

-- =============================================================================
-- PART 2: Safe audit trigger behavior on company deletion & bulk wipe/restore
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_workspace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  row_id uuid;
  company_id uuid;
  operation_name text;
  audit_details jsonb;
BEGIN
  IF current_setting('app.skip_workspace_audit', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  operation_name := lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
    IF TG_TABLE_NAME = 'empresas' THEN
      company_id := OLD.id;
    ELSE
      company_id := OLD.empresa_id;
    END IF;
  ELSE
    row_id := NEW.id;
    IF TG_TABLE_NAME = 'empresas' THEN
      company_id := NEW.id;
    ELSE
      company_id := NEW.empresa_id;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND (company_id IS NOT NULL OR TG_TABLE_NAME = 'empresas') THEN
    audit_details := jsonb_build_object('operacao', operation_name);
    IF company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = company_id) THEN
      audit_details := audit_details || jsonb_build_object('empresa_id_removida', company_id);
      company_id := NULL;
    END IF;

    IF company_id IS NOT NULL OR (TG_TABLE_NAME = 'empresas' AND TG_OP = 'DELETE') THEN
      INSERT INTO public.auditoria (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
      VALUES (company_id, auth.uid(), TG_TABLE_NAME || '_' || operation_name, TG_TABLE_NAME, row_id, audit_details);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_workspace_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_owner_workspace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  row_data jsonb;
  row_id uuid;
  company_id uuid;
  owner_id uuid;
  operation_name text := lower(TG_OP);
  actor_id uuid := auth.uid();
  audit_details jsonb;
BEGIN
  IF current_setting('app.skip_workspace_audit', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  row_id := nullif(row_data ->> 'id', '')::uuid;
  company_id := nullif(row_data ->> 'empresa_id', '')::uuid;
  owner_id := coalesce(
    nullif(row_data ->> 'owner_id', '')::uuid,
    nullif(row_data ->> 'user_id', '')::uuid
  );

  IF actor_id IS NOT NULL AND (company_id IS NOT NULL OR owner_id = actor_id) THEN
    audit_details := jsonb_build_object('operacao', operation_name);
    IF company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = company_id) THEN
      audit_details := audit_details || jsonb_build_object('empresa_id_removida', company_id);
      company_id := NULL;
    END IF;

    INSERT INTO public.auditoria
      (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
    VALUES
      (company_id, actor_id, TG_TABLE_NAME || '_' || operation_name,
       TG_TABLE_NAME, row_id, audit_details);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_owner_workspace_change() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- PART 3: Internal restore resolution helpers + clear/restore RPCs
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION private.backup_resolve_auth_user(p_candidate text, p_fallback uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT CASE
    WHEN p_candidate IS NOT NULL
      AND p_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_candidate::uuid)
    THEN p_candidate::uuid
    ELSE p_fallback
  END;
$$;

CREATE OR REPLACE FUNCTION private.backup_resolve_profile_user(p_candidate text, p_fallback uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_candidate IS NOT NULL
      AND p_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_candidate::uuid)
    THEN p_candidate::uuid
    ELSE p_fallback
  END;
$$;

CREATE OR REPLACE FUNCTION private.backup_resolve_empresa(p_candidate text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_candidate IS NOT NULL
      AND p_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (SELECT 1 FROM public.empresas AS e WHERE e.id = p_candidate::uuid)
    THEN p_candidate::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION private.backup_safe_uuid_or_null(p_candidate text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT CASE
    WHEN p_candidate IS NOT NULL
      AND p_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN p_candidate::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION private.backup_resolve_auth_user(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.backup_resolve_profile_user(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.backup_resolve_empresa(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.backup_safe_uuid_or_null(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_clear_operational_data(p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  counts jsonb := '{}'::jsonb;
  affected bigint;
  table_name text;
  contracts_seq text;
BEGIN
  IF actor_id IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS DISTINCT FROM 'APAGAR TODOS OS DADOS' THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite APAGAR TODOS OS DADOS.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.skip_workspace_audit', 'on', true);

  -- Unlink marketing_projects(empresa_id, client_id) atomically before deleting
  -- clients/empresas so ON DELETE SET NULL on one column cannot violate
  -- CHECK ((empresa_id IS NULL) = (client_id IS NULL)).
  IF to_regclass('public.marketing_projects') IS NOT NULL THEN
    UPDATE public.marketing_projects
    SET empresa_id = NULL, client_id = NULL
    WHERE empresa_id IS NOT NULL OR client_id IS NOT NULL;
  END IF;

  -- Child-first ordering, including tables with ON DELETE RESTRICT FKs such as
  -- vendedor_visitas -> vendedores and contratos/parcelas -> clients/services.
  FOREACH table_name IN ARRAY ARRAY[
    'estornos',
    'lancamentos',
    'parcelas',
    'agenda_historico',
    'agenda',
    'assinaturas',
    'contrato_historico',
    'contratos',
    'vendedor_visitas',
    'gm_chat_messages',
    'gm_vendor_activation_events',
    'vendedor_desempenho',
    'comissoes',
    'vendedores',
    'gm_financial_entries',
    'gm_contracts',
    'signature_signers',
    'signature_events',
    'signature_envelopes',
    'gm_files',
    'services',
    'client_historico',
    'clients',
    'convites',
    'empresa_members',
    'empresas'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      IF table_name = 'comissoes' AND to_regclass('public.vendedores') IS NOT NULL THEN
        UPDATE public.vendedores SET comissao_rule_id = NULL WHERE comissao_rule_id IS NOT NULL;
      END IF;
      EXECUTE format('DELETE FROM public.%I', table_name);
      GET DIAGNOSTICS affected = ROW_COUNT;
      counts := counts || jsonb_build_object(table_name, affected);
    END IF;
  END LOOP;

  IF to_regclass('public.gm_contracts') IS NOT NULL THEN
    contracts_seq := pg_get_serial_sequence('public.gm_contracts', 'numero');
    IF contracts_seq IS NOT NULL THEN
      PERFORM setval(contracts_seq, 1, false);
    END IF;
  END IF;

  INSERT INTO public.gm_admin_audit (admin_user_id, action, details)
    VALUES (actor_id, 'system.operational_data_cleared', jsonb_build_object('deleted', counts));

  RETURN jsonb_build_object(
    'cleared', true,
    'deleted', counts,
    'preserved', jsonb_build_array(
      'authentication users and profiles',
      'platform admin roles',
      'audit logs',
      'SMTP configuration',
      'Storage binaries'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_system_backup(p_datasets jsonb, p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  table_name text;
  item jsonb;
  normalized jsonb;
  total_records bigint := 0;
  counts jsonb := '{}'::jsonb;
  empresa_resp_notnull boolean := false;
  resolved_user_id uuid;
  resolved_empresa_id uuid;
  orig_path text;
  file_cat text;
  next_path text;
  contracts_seq text;
  max_contract_num bigint;
  has_contracts boolean;
  tables text[] := ARRAY[
    'empresas', 'clients', 'services', 'vendedores', 'comissoes',
    'vendedor_desempenho', 'contratos', 'assinaturas', 'parcelas',
    'lancamentos', 'estornos', 'agenda', 'gm_contracts', 'gm_files',
    'gm_financial_entries', 'signature_envelopes'
  ];
BEGIN
  IF actor_id IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS DISTINCT FROM 'RESTAURAR E SUBSTITUIR DADOS' THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite RESTAURAR E SUBSTITUIR DADOS.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_datasets) IS DISTINCT FROM 'object'
    OR octet_length(p_datasets::text) > 50000000 THEN
    RAISE EXCEPTION 'Dados de backup inválidos ou maiores que 50 MB.' USING ERRCODE = '22023';
  END IF;

  FOR table_name IN SELECT jsonb_object_keys(p_datasets) LOOP
    IF NOT table_name = ANY(tables) THEN
      RAISE EXCEPTION 'Dataset não permitido: %.', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY tables LOOP
    IF jsonb_typeof(p_datasets -> table_name) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Dataset % ausente ou inválido.', table_name USING ERRCODE = '22023';
    END IF;
    total_records := total_records + jsonb_array_length(p_datasets -> table_name);
  END LOOP;
  IF total_records > 100000 THEN
    RAISE EXCEPTION 'O backup excede 100.000 registros.' USING ERRCODE = '22023';
  END IF;

  -- Ensure the restoring platform admin has a profile row before remapping any
  -- required profile foreign keys (e.g. agenda.responsavel_id) to actor_id.
  INSERT INTO public.profiles (id, email, nome, role)
  SELECT
    u.id,
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data ->> 'nome', split_part(COALESCE(u.email, 'admin'), '@', 1)),
    'operador'
  FROM auth.users AS u
  WHERE u.id = actor_id
  ON CONFLICT (id) DO NOTHING;

  SELECT attnotnull INTO empresa_resp_notnull
  FROM pg_attribute
  WHERE attrelid = 'public.empresas'::regclass
    AND attname = 'responsavel_id'
    AND NOT attisdropped;
  empresa_resp_notnull := COALESCE(empresa_resp_notnull, false);

  PERFORM set_config('app.skip_workspace_audit', 'on', true);

  -- Replacing data is deliberately atomic: any invalid row or constraint rolls
  -- back both the deletion and every insert in this transaction.
  PERFORM public.admin_clear_operational_data('APAGAR TODOS OS DADOS');

  -- 1. Base tenant and catalog tables
  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'empresas') LOOP
    normalized := item || jsonb_build_object(
      'responsavel_id', private.backup_resolve_profile_user(
        item ->> 'responsavel_id',
        CASE WHEN empresa_resp_notnull THEN actor_id ELSE NULL END
      ),
      'configuracoes', COALESCE(NULLIF(item -> 'configuracoes', 'null'::jsonb), '{}'::jsonb),
      'endereco', COALESCE(NULLIF(item -> 'endereco', 'null'::jsonb), '{}'::jsonb),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.empresas SELECT (jsonb_populate_record(NULL::public.empresas, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('empresas', jsonb_array_length(p_datasets -> 'empresas'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'clients') LOOP
    normalized := item || jsonb_build_object(
      'tipo', COALESCE(NULLIF(item ->> 'tipo', ''), 'pessoa_fisica'),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'ativo'),
      'endereco', COALESCE(NULLIF(item -> 'endereco', 'null'::jsonb), '{}'::jsonb),
      'criado_por', private.backup_resolve_profile_user(item ->> 'criado_por', NULL),
      'atualizado_por', private.backup_resolve_profile_user(item ->> 'atualizado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.clients SELECT (jsonb_populate_record(NULL::public.clients, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('clients', jsonb_array_length(p_datasets -> 'clients'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'services') LOOP
    normalized := item || jsonb_build_object(
      'categoria', COALESCE(NULLIF(item ->> 'categoria', ''), 'geral'),
      'valor_base', COALESCE(NULLIF(item -> 'valor_base', 'null'::jsonb), '0'::jsonb),
      'unidade', COALESCE(NULLIF(item ->> 'unidade', ''), 'unidade'),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'ativo'),
      'ordem', COALESCE(NULLIF(item -> 'ordem', 'null'::jsonb), '0'::jsonb),
      'bonus_automatico', COALESCE(NULLIF(item -> 'bonus_automatico', 'null'::jsonb), 'false'::jsonb),
      'bonus_gatilhos', COALESCE(NULLIF(item -> 'bonus_gatilhos', 'null'::jsonb), '[]'::jsonb),
      'contratacao_permitida', COALESCE(NULLIF(item -> 'contratacao_permitida', 'null'::jsonb), 'true'::jsonb),
      'bonus_permitido', COALESCE(NULLIF(item -> 'bonus_permitido', 'null'::jsonb), 'true'::jsonb),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.services SELECT (jsonb_populate_record(NULL::public.services, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('services', jsonb_array_length(p_datasets -> 'services'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'vendedores') LOOP
    normalized := (item - 'comissao_rule_id') || jsonb_build_object(
      'role', COALESCE(NULLIF(item ->> 'role', ''), 'vendedor'),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'ativo'),
      'usuario_id', private.backup_resolve_profile_user(item ->> 'usuario_id', NULL),
      'atualizado_por', private.backup_resolve_profile_user(item ->> 'atualizado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.vendedores SELECT (jsonb_populate_record(NULL::public.vendedores, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('vendedores', jsonb_array_length(p_datasets -> 'vendedores'));

  -- 2. Dependent operational tables
  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'comissoes') LOOP
    normalized := item || jsonb_build_object(
      'tipo', COALESCE(NULLIF(item ->> 'tipo', ''), 'percentual'),
      'valor', COALESCE(NULLIF(item -> 'valor', 'null'::jsonb), '0'::jsonb),
      'ativo', COALESCE(NULLIF(item -> 'ativo', 'null'::jsonb), 'true'::jsonb),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.comissoes SELECT (jsonb_populate_record(NULL::public.comissoes, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('comissoes', jsonb_array_length(p_datasets -> 'comissoes'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'vendedor_desempenho') LOOP
    normalized := item || jsonb_build_object(
      'contratos_criados', COALESCE(NULLIF(item -> 'contratos_criados', 'null'::jsonb), '0'::jsonb),
      'contratos_assinados', COALESCE(NULLIF(item -> 'contratos_assinados', 'null'::jsonb), '0'::jsonb),
      'valor_total_contratos', COALESCE(NULLIF(item -> 'valor_total_contratos', 'null'::jsonb), '0'::jsonb),
      'valor_recebido', COALESCE(NULLIF(item -> 'valor_recebido', 'null'::jsonb), '0'::jsonb),
      'comissao_calculada', COALESCE(NULLIF(item -> 'comissao_calculada', 'null'::jsonb), '0'::jsonb),
      'meta_alcancada', COALESCE(NULLIF(item -> 'meta_alcancada', 'null'::jsonb), '0'::jsonb),
      'percentual_meta', COALESCE(NULLIF(item -> 'percentual_meta', 'null'::jsonb), '0'::jsonb),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.vendedor_desempenho SELECT (jsonb_populate_record(NULL::public.vendedor_desempenho, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('vendedor_desempenho', jsonb_array_length(p_datasets -> 'vendedor_desempenho'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'contratos') LOOP
    normalized := item || jsonb_build_object(
      'vendedor_id', private.backup_safe_uuid_or_null(item ->> 'vendedor_id'),
      'valor_base', COALESCE(NULLIF(item -> 'valor_base', 'null'::jsonb), '0'::jsonb),
      'desconto', COALESCE(NULLIF(item -> 'desconto', 'null'::jsonb), '0'::jsonb),
      'acrescimo', COALESCE(NULLIF(item -> 'acrescimo', 'null'::jsonb), '0'::jsonb),
      'valor_total', COALESCE(NULLIF(item -> 'valor_total', 'null'::jsonb), '0'::jsonb),
      'entrada', COALESCE(NULLIF(item -> 'entrada', 'null'::jsonb), '0'::jsonb),
      'qtd_parcelas', COALESCE(NULLIF(item -> 'qtd_parcelas', 'null'::jsonb), '1'::jsonb),
      'data_emissao', COALESCE(NULLIF(item -> 'data_emissao', 'null'::jsonb), to_jsonb(CURRENT_DATE)),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'rascunho'),
      'criado_por', private.backup_resolve_profile_user(item ->> 'criado_por', NULL),
      'atualizado_por', private.backup_resolve_profile_user(item ->> 'atualizado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.contratos SELECT (jsonb_populate_record(NULL::public.contratos, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('contratos', jsonb_array_length(p_datasets -> 'contratos'));

  contracts_seq := pg_get_serial_sequence('public.gm_contracts', 'numero');
  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'gm_contracts') LOOP
    resolved_user_id := private.backup_resolve_auth_user(item ->> 'user_id', actor_id);
    resolved_empresa_id := private.backup_resolve_empresa(
      COALESCE(NULLIF(item ->> 'empresa_id', ''), NULLIF(item #>> '{payload,empresa_id}', ''))
    );
    normalized := item || jsonb_build_object(
      'user_id', resolved_user_id,
      'empresa_id', resolved_empresa_id,
      'numero', CASE
        WHEN NULLIF(item ->> 'numero', '') IS NOT NULL THEN (item ->> 'numero')::bigint
        ELSE nextval(contracts_seq)
      END,
      'created_at', COALESCE(NULLIF(item -> 'created_at', 'null'::jsonb), to_jsonb(now())),
      'updated_at', COALESCE(NULLIF(item -> 'updated_at', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.gm_contracts SELECT (jsonb_populate_record(NULL::public.gm_contracts, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('gm_contracts', jsonb_array_length(p_datasets -> 'gm_contracts'));

  IF contracts_seq IS NOT NULL THEN
    SELECT MAX(numero), COUNT(*) > 0 INTO max_contract_num, has_contracts FROM public.gm_contracts;
    PERFORM setval(contracts_seq, COALESCE(max_contract_num, 1), COALESCE(has_contracts, false));
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'gm_files') LOOP
    resolved_user_id := private.backup_resolve_auth_user(item ->> 'user_id', actor_id);
    orig_path := COALESCE(item ->> 'object_path', '');
    file_cat := COALESCE(NULLIF(item ->> 'categoria', ''), 'arquivos');

    IF split_part(orig_path, '/', 1) IS DISTINCT FROM resolved_user_id::text
       OR split_part(orig_path, '/', 2) IS DISTINCT FROM file_cat THEN
      IF strpos(orig_path, '/') > 0 AND split_part(orig_path, '/', 2) = file_cat THEN
        next_path := resolved_user_id::text || '/' || substr(orig_path, strpos(orig_path, '/') + 1);
      ELSE
        next_path := resolved_user_id::text || '/' || file_cat || '/' ||
          COALESCE(NULLIF(regexp_replace(orig_path, '^.*/', ''), ''), COALESCE(item ->> 'id', gen_random_uuid()::text));
      END IF;
    ELSE
      next_path := orig_path;
    END IF;

    IF EXISTS (SELECT 1 FROM public.gm_files AS f WHERE f.object_path = next_path) THEN
      next_path := resolved_user_id::text || '/' || file_cat || '/' ||
        COALESCE(item ->> 'id', gen_random_uuid()::text) || '-' ||
        COALESCE(NULLIF(regexp_replace(orig_path, '^.*/', ''), ''), 'arquivo');
    END IF;

    normalized := item || jsonb_build_object(
      'user_id', resolved_user_id,
      'bucket_id', COALESCE(NULLIF(item ->> 'bucket_id', ''), 'growmoney-files'),
      'object_path', next_path,
      'created_at', COALESCE(NULLIF(item -> 'created_at', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.gm_files SELECT (jsonb_populate_record(NULL::public.gm_files, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('gm_files', jsonb_array_length(p_datasets -> 'gm_files'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'gm_financial_entries') LOOP
    normalized := item || jsonb_build_object(
      'valor', COALESCE(NULLIF(item -> 'valor', 'null'::jsonb), '0'::jsonb),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'pendente'),
      'criado_por', private.backup_resolve_profile_user(item ->> 'criado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.gm_financial_entries SELECT (jsonb_populate_record(NULL::public.gm_financial_entries, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('gm_financial_entries', jsonb_array_length(p_datasets -> 'gm_financial_entries'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'signature_envelopes') LOOP
    IF item #>> '{payload,signers}' IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(item #> '{payload,signers}', '[]'::jsonb)) AS signer
         WHERE signer ->> 'token' IS NULL
       ) THEN
      RAISE EXCEPTION 'Backups não incluem tokens privados de assinatura; remova esses envelopes antes de restaurar.' USING ERRCODE = '22023';
    END IF;
    resolved_user_id := private.backup_resolve_auth_user(item ->> 'owner_id', actor_id);
    resolved_empresa_id := private.backup_resolve_empresa(
      COALESCE(NULLIF(item ->> 'empresa_id', ''), NULLIF(item #>> '{payload,empresa_id}', ''))
    );
    normalized := item || jsonb_build_object(
      'owner_id', resolved_user_id,
      'empresa_id', resolved_empresa_id,
      'created_at', COALESCE(NULLIF(item -> 'created_at', 'null'::jsonb), to_jsonb(now())),
      'updated_at', COALESCE(NULLIF(item -> 'updated_at', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.signature_envelopes SELECT (jsonb_populate_record(NULL::public.signature_envelopes, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('signature_envelopes', jsonb_array_length(p_datasets -> 'signature_envelopes'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'assinaturas') LOOP
    normalized := item || jsonb_build_object(
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'pendente'),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.assinaturas SELECT (jsonb_populate_record(NULL::public.assinaturas, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('assinaturas', jsonb_array_length(p_datasets -> 'assinaturas'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'parcelas') LOOP
    normalized := item || jsonb_build_object(
      'valor_contratado', COALESCE(NULLIF(item -> 'valor_contratado', 'null'::jsonb), '0'::jsonb),
      'valor_previsto', COALESCE(NULLIF(item -> 'valor_previsto', 'null'::jsonb), '0'::jsonb),
      'valor_recebido', COALESCE(NULLIF(item -> 'valor_recebido', 'null'::jsonb), '0'::jsonb),
      'valor_saldo', COALESCE(NULLIF(item -> 'valor_saldo', 'null'::jsonb), '0'::jsonb),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'pendente'),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.parcelas SELECT (jsonb_populate_record(NULL::public.parcelas, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('parcelas', jsonb_array_length(p_datasets -> 'parcelas'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'lancamentos') LOOP
    normalized := item || jsonb_build_object(
      'data_pagamento', COALESCE(NULLIF(item -> 'data_pagamento', 'null'::jsonb), to_jsonb(CURRENT_DATE)),
      'forma_pagamento', COALESCE(NULLIF(item ->> 'forma_pagamento', ''), 'pix'),
      'criado_por', private.backup_resolve_profile_user(item ->> 'criado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.lancamentos SELECT (jsonb_populate_record(NULL::public.lancamentos, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('lancamentos', jsonb_array_length(p_datasets -> 'lancamentos'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'estornos') LOOP
    normalized := item || jsonb_build_object(
      'data_estorno', COALESCE(NULLIF(item -> 'data_estorno', 'null'::jsonb), to_jsonb(CURRENT_DATE)),
      'criado_por', private.backup_resolve_profile_user(item ->> 'criado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.estornos SELECT (jsonb_populate_record(NULL::public.estornos, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('estornos', jsonb_array_length(p_datasets -> 'estornos'));

  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'agenda') LOOP
    normalized := item || jsonb_build_object(
      'cliente_id', private.backup_safe_uuid_or_null(item ->> 'cliente_id'),
      'contrato_id', private.backup_safe_uuid_or_null(item ->> 'contrato_id'),
      'servico_id', private.backup_safe_uuid_or_null(item ->> 'servico_id'),
      'responsavel_id', private.backup_resolve_profile_user(item ->> 'responsavel_id', actor_id),
      'tipo', COALESCE(NULLIF(item ->> 'tipo', ''), 'reuniao'),
      'status', COALESCE(NULLIF(item ->> 'status', ''), 'agendado'),
      'duracao_minutos', COALESCE(NULLIF(item -> 'duracao_minutos', 'null'::jsonb), '60'::jsonb),
      'criado_por', private.backup_resolve_profile_user(item ->> 'criado_por', NULL),
      'atualizado_por', private.backup_resolve_profile_user(item ->> 'atualizado_por', NULL),
      'criado_em', COALESCE(NULLIF(item -> 'criado_em', 'null'::jsonb), to_jsonb(now())),
      'atualizado_em', COALESCE(NULLIF(item -> 'atualizado_em', 'null'::jsonb), to_jsonb(now()))
    );
    INSERT INTO public.agenda SELECT (jsonb_populate_record(NULL::public.agenda, normalized)).*;
  END LOOP;
  counts := counts || jsonb_build_object('agenda', jsonb_array_length(p_datasets -> 'agenda'));

  -- Restore the nullable circular link after both vendedores and comissoes exist.
  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'vendedores') LOOP
    IF private.backup_safe_uuid_or_null(item ->> 'comissao_rule_id') IS NOT NULL THEN
      UPDATE public.vendedores
      SET comissao_rule_id = (item ->> 'comissao_rule_id')::uuid
      WHERE id = (item ->> 'id')::uuid
        AND EXISTS (
          SELECT 1 FROM public.comissoes AS c WHERE c.id = (item ->> 'comissao_rule_id')::uuid
        );
    END IF;
  END LOOP;

  INSERT INTO public.gm_admin_audit (admin_user_id, action, details)
    VALUES (actor_id, 'system.backup_restored', jsonb_build_object('inserted', counts));

  RETURN jsonb_build_object(
    'restored', true,
    'inserted', counts,
    'recordCount', total_records,
    'preserved', jsonb_build_array(
      'authentication users and profiles',
      'platform admin roles',
      'audit logs',
      'SMTP configuration'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_operational_data(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_restore_system_backup(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_operational_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_system_backup(jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
