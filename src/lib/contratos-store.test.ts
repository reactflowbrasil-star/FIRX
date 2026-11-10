import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
}));
const query = vi.hoisted(() => ({
  upsert: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: supabaseMock }));

import { listContratosRemotos, saveContrato, updateContrato } from './contratos-store';

describe('contratos-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'seller-1' } }, error: null });
    supabaseMock.from.mockReturnValue(query);
    query.upsert.mockResolvedValue({ error: null });
    query.insert.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.or.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    query.single.mockResolvedValue({ data: null, error: null });
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('does not import the shared legacy bucket into a seller account', async () => {
    localStorage.setItem('empresaAtiva', 'company-1');
    localStorage.setItem('gm_contratos_v1', JSON.stringify([{ id: 'legacy-1', status: 'rascunho' }]));
    supabaseMock.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === 'empresa_role' ? 'vendedor' : false,
      error: null,
    }));

    await listContratosRemotos();

    expect(query.upsert).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'seller-1');
    expect(localStorage.getItem('gm_contratos_v1')).not.toBeNull();
  });

  it('allows a platform admin to migrate legacy contracts', async () => {
    localStorage.setItem('gm_contratos_v1', JSON.stringify([{ id: 'legacy-1', status: 'rascunho' }]));
    supabaseMock.rpc.mockResolvedValue({ data: true, error: null });

    await listContratosRemotos();

    expect(query.upsert).toHaveBeenCalledOnce();
    expect(query.upsert.mock.calls[0][0][0]).toMatchObject({ user_id: 'seller-1', status: 'rascunho' });
    expect(localStorage.getItem('gm_contratos_v1')).toBeNull();
  });

  it('filters by empresa_id and payload.empresa_id for company admins and hydrates empresa_id', async () => {
    const empresaId = '11111111-1111-4111-8111-111111111111';
    localStorage.setItem('empresaAtiva', empresaId);
    supabaseMock.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === 'empresa_role' ? 'admin' : false,
      error: null,
    }));
    query.order.mockResolvedValueOnce({
      data: [
        {
          id: 'c-1',
          numero: 12,
          empresa_id: empresaId,
          status: 'enviado',
          created_at: '2026-10-20T12:00:00Z',
          payload: { cliente_nome: 'Cliente A', itens: [] },
        },
        {
          id: 'c-2',
          numero: 11,
          empresa_id: null,
          status: 'rascunho',
          created_at: '2026-10-19T12:00:00Z',
          payload: { cliente_nome: 'Cliente B', empresa_id: empresaId, itens: [] },
        },
      ],
      error: null,
    });

    const result = await listContratosRemotos();

    expect(query.or).toHaveBeenCalledWith(`empresa_id.eq.${empresaId},and(empresa_id.is.null,payload->>empresa_id.eq.${empresaId})`);
    expect(result).toHaveLength(2);
    expect(result[0].empresa_id).toBe(empresaId);
    expect(result[1].empresa_id).toBe(empresaId);
  });

  it('falls back gracefully when gm_contracts.empresa_id column is missing on read and save', async () => {
    const empresaId = '11111111-1111-4111-8111-111111111111';
    localStorage.setItem('empresaAtiva', empresaId);
    supabaseMock.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === 'empresa_role' ? 'admin' : false,
      error: null,
    }));
    query.order
      .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column gm_contracts.empresa_id does not exist' } })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'c-1',
            numero: 1,
            status: 'rascunho',
            created_at: '2026-10-20T12:00:00Z',
            payload: { cliente_nome: 'Empresa Atual', empresa_id: empresaId, itens: [] },
          },
          {
            id: 'c-2',
            numero: 2,
            status: 'rascunho',
            created_at: '2026-10-20T12:00:00Z',
            payload: { cliente_nome: 'Outra Empresa', empresa_id: '22222222-2222-4222-8222-222222222222', itens: [] },
          },
        ],
        error: null,
      });

    const listed = await listContratosRemotos();
    expect(listed.map((c) => c.id)).toEqual(['c-1']);

    query.single
      .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column "empresa_id" of relation "gm_contracts" does not exist' } })
      .mockResolvedValueOnce({
        data: {
          id: 'c-3',
          numero: 3,
          status: 'rascunho',
          created_at: '2026-10-21T12:00:00Z',
          payload: { cliente_nome: 'Novo', empresa_id: empresaId, itens: [] },
        },
        error: null,
      });

    const saved = await saveContrato({
      client_id: 'cli-1',
      cliente_nome: 'Novo',
      itens: [],
      unidades: 1,
      valor_bruto: 100,
      valor: 100,
      desconto_valor: 0,
      desconto_percentual: 0,
      bonus_total: 0,
      forma_pagamento: 'pix',
      parcelas: 1,
      valor_parcela: 100,
      entrada_valor: 0,
      periodicidade: 'mensal',
      plano_recorrente: false,
      data_inicio: '2026-10-21',
      status: 'rascunho',
    });

    expect(query.insert).toHaveBeenCalledTimes(2);
    expect(query.insert.mock.calls[0][0]).toMatchObject({ empresa_id: empresaId });
    expect(query.insert.mock.calls[1][0]).not.toHaveProperty('empresa_id');
    expect(saved.empresa_id).toBe(empresaId);
  });

  it('backfills empresa_id on updateContrato when legacy row had empresa_id only in payload', async () => {
    const empresaId = '11111111-1111-4111-8111-111111111111';
    query.maybeSingle.mockResolvedValueOnce({
      data: {
        empresa_id: null,
        status: 'rascunho',
        payload: { cliente_nome: 'Antigo', empresa_id: empresaId, status: 'rascunho', itens: [] },
      },
      error: null,
    });
    query.single.mockResolvedValueOnce({
      data: {
        id: 'c-legacy',
        numero: 7,
        empresa_id: empresaId,
        status: 'enviado',
        created_at: '2026-10-21T12:00:00Z',
        payload: { cliente_nome: 'Antigo', empresa_id: empresaId, status: 'enviado', itens: [] },
      },
      error: null,
    });

    const updated = await updateContrato('c-legacy', { status: 'enviado' });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ empresa_id: empresaId, status: 'enviado' }));
    expect(updated.empresa_id).toBe(empresaId);
  });
});
