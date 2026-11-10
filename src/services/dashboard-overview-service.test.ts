import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: supabaseMock }));

import { getDashboardOverview } from './dashboard-overview-service';

describe('getDashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty overview without querying when empresaId is null', async () => {
    const result = await getDashboardOverview(null);
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result.resumo).toEqual({
      clientes: 0,
      contratos: 0,
      parcelasAtrasadas: 0,
      recebido: 0,
      aReceber: 0,
    });
  });

  it('merges contratos and gm_contracts and counts overdue pending financial entries', async () => {
    const eqTable = (table: string) => {
      if (table === 'clients') return Promise.resolve({ count: 3, error: null });
      if (table === 'contratos') return Promise.resolve({ data: [{ id: 'c1', status: 'assinado', valor_total: 1000 }], error: null });
      if (table === 'gm_contracts') return Promise.resolve({ data: [{ id: 'gm1', status: 'pendente_assinatura' }, { id: 'c1', status: 'assinado' }], error: null });
      if (table === 'parcelas') return Promise.resolve({ data: [], error: null });
      if (table === 'gm_financial_entries') {
        return Promise.resolve({
          data: [
            { valor: 250, status: 'pendente', vencimento: '2020-01-01' },
            { valor: 500, status: 'pago', vencimento: '2026-11-10' },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    };

    supabaseMock.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => eqTable(table)),
      })),
    }));

    const result = await getDashboardOverview('emp-1');

    expect(result.resumo.clientes).toBe(3);
    expect(result.resumo.contratos).toBe(2);
    expect(result.resumo.parcelasAtrasadas).toBe(1);
    expect(result.resumo.recebido).toBe(500);
    expect(result.resumo.aReceber).toBe(250);
    expect(result.contratosPorStatus).toEqual([
      { status: 'Assinado', total: 1 },
      { status: 'Aguardando assinatura', total: 1 },
    ]);
  });
});
