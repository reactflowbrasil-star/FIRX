-- Fix PostgreSQL safeupdate error (21000: DELETE requires a WHERE clause)
-- when admin_clear_operational_data is invoked through PostgREST RPC.

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

  IF to_regclass('public.marketing_projects') IS NOT NULL THEN
    UPDATE public.marketing_projects
    SET empresa_id = NULL, client_id = NULL
    WHERE empresa_id IS NOT NULL OR client_id IS NOT NULL;
  END IF;

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
      EXECUTE format('DELETE FROM public.%I WHERE ctid IS NOT NULL', table_name);
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

REVOKE ALL ON FUNCTION public.admin_clear_operational_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_operational_data(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
