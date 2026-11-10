import { beforeEach, describe, expect, it, vi } from 'vitest';

const builder = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(() => builder),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: supabaseMock }));

import { ServicoRepository } from './servico-repository';
import { VendedorRepository } from './vendedor-repository';
import { AgendaRepository } from './agenda-repository';
import { EmpresaRepository } from './empresa-repository';

describe('Repository schema alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockResolvedValue({ data: [], count: 0, error: null });
    builder.single.mockResolvedValue({ data: { id: 'row-1' }, error: null });
    supabaseMock.rpc.mockResolvedValue({ data: 'emp-created', error: null });
  });

  it('ServicoRepository.create does not send nonexistent criado_por column and findMany sanitizes search', async () => {
    await ServicoRepository.create({
      empresa_id: 'emp-1',
      codigo: 'SVC-1',
      nome: 'Gestão',
      categoria: 'Ads',
      valor_base: 500,
    }, 'user-1');

    expect(supabaseMock.from).toHaveBeenCalledWith('services');
    expect(builder.insert.mock.calls[0][0]).not.toHaveProperty('criado_por');

    await ServicoRepository.findMany({ empresaId: 'emp-1', busca: 'a,b(c)%d' });
    expect(builder.or).toHaveBeenCalledWith('nome.ilike.%a b c d%,codigo.ilike.%a b c d%,categoria.ilike.%a b c d%');
  });

  it('VendedorRepository.create does not send criado_por and getComissoes does not filter by nonexistent periodo', async () => {
    await VendedorRepository.create({
      empresa_id: 'emp-1',
      nome: 'Ana',
      email: 'ana@example.com',
      identificador_interno: 'V-01',
      role: 'vendedor',
    }, 'user-1');

    expect(supabaseMock.from).toHaveBeenCalledWith('vendedores');
    expect(builder.insert.mock.calls[0][0]).not.toHaveProperty('criado_por');
    expect(builder.insert.mock.calls[0][0]).toMatchObject({ atualizado_por: 'user-1' });

    builder.eq.mockReturnValueOnce(builder).mockReturnValueOnce(builder).mockResolvedValueOnce({ data: [], error: null });
    await VendedorRepository.getComissoes('vend-1', 'emp-1', '2026-10');
    expect(builder.eq).not.toHaveBeenCalledWith('periodo', expect.anything());
    expect(builder.eq).toHaveBeenCalledWith('ativo', true);
  });

  it('AgendaRepository.create computes data_fim from duracao_minutos so conflict detection works', async () => {
    await AgendaRepository.create({
      empresa_id: 'emp-1',
      responsavel_id: 'user-1',
      tipo: 'reuniao',
      title: 'Alinhamento',
      data_hora: '2026-11-10T10:00:00.000Z',
      duracao_minutos: 45,
    }, 'user-1');

    expect(supabaseMock.from).toHaveBeenCalledWith('agenda');
    expect(builder.insert.mock.calls[0][0]).toMatchObject({
      duracao_minutos: 45,
      data_fim: '2026-11-10T10:45:00.000Z',
      criado_por: 'user-1',
    });
  });

  it('EmpresaRepository.create uses create_empresa_with_admin RPC instead of revoked direct insert', async () => {
    await EmpresaRepository.create({
      nome: 'Acme',
      cnpj: '12345678000199',
      razao_social: 'Acme Ltda',
    }, 'user-1');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_empresa_with_admin', {
      p_nome: 'Acme',
      p_cnpj: '12345678000199',
    });
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ razao_social: 'Acme Ltda' }));
  });

  it('EmpresaRepository.acceptConvite uses accept_empresa_invite RPC', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 'member-1', error: null });
    await EmpresaRepository.acceptConvite('tok-123', 'user-1');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('accept_empresa_invite', { p_token: 'tok-123' });
  });
});
