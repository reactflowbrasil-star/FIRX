import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, rpcMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

import {
  AdminSystemBackupService,
  SYSTEM_BACKUP_DATASETS,
  SYSTEM_BACKUP_FORMAT,
  SYSTEM_BACKUP_VERSION,
  validateSystemBackup,
} from './admin-system-backup-service';

const companyId = 'bda65574-51ba-46d5-b9c3-a26d367a8e45';
const clientId = '9b653e85-859b-496e-acb0-30b6b079aa47';
const userId = '3e90d31c-221a-45e0-965a-116a9f578b91';
const contractId = 'a29e4055-43f1-4b5f-84e6-8d4b7b92c670';

function backupWith(overrides: Record<string, unknown[]> = {}) {
  const datasets = Object.fromEntries(SYSTEM_BACKUP_DATASETS.map((table) => [table, []])) as Record<string, unknown[]>;
  return {
    format: SYSTEM_BACKUP_FORMAT,
    version: SYSTEM_BACKUP_VERSION,
    createdAt: '2026-10-23T00:00:00.000Z',
    datasets: {
      ...datasets,
      empresas: [{ id: companyId, nome: 'Empresa' }],
      clients: [{ id: clientId, empresa_id: companyId, nome: 'Cliente', documento: '12345678901' }],
      ...overrides,
    },
    exclusions: [],
    redactions: [],
  };
}

describe('validateSystemBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'is_platform_admin') return { data: true, error: null };
      return { data: null, error: null };
    });
  });

  it('accepts a structurally complete backup for transactional restoration', () => {
    const preview = validateSystemBackup(backupWith());

    expect(preview.valid).toBe(true);
    expect(preview.recordCount).toBe(2);
    expect(preview.canApply).toBe(true);
    expect(preview.blockedReason).toContain('única transação');
  });

  it('accepts gm_contracts with or without empresa_id (legacy and current schemas)', () => {
    const legacy = validateSystemBackup(backupWith({
      gm_contracts: [
        { id: contractId, user_id: userId, numero: 1, status: 'rascunho', payload: { empresa_id: companyId, cliente_nome: 'Cliente' } },
      ],
    }));
    expect(legacy.valid).toBe(true);

    const withNullable = validateSystemBackup(backupWith({
      gm_contracts: [
        { id: contractId, user_id: userId, empresa_id: null, numero: 1, status: 'rascunho', payload: { cliente_nome: 'Cliente' } },
      ],
    }));
    expect(withNullable.valid).toBe(true);

    const withTenant = validateSystemBackup(backupWith({
      gm_contracts: [
        { id: contractId, user_id: userId, empresa_id: companyId, numero: 1, status: 'assinado', payload: { empresa_id: companyId } },
      ],
    }));
    expect(withTenant.valid).toBe(true);
  });

  it('rejects gm_contracts with invalid or unincluded empresa_id', () => {
    const invalidUuid = validateSystemBackup(backupWith({
      gm_contracts: [
        { id: contractId, user_id: userId, empresa_id: '', status: 'rascunho', payload: {} },
      ],
    }));
    expect(invalidUuid.valid).toBe(false);
    expect(invalidUuid.errors.some((error) => error.includes('gm_contracts[0].empresa_id'))).toBe(true);

    const missingEmpresa = validateSystemBackup(backupWith({
      gm_contracts: [
        { id: contractId, user_id: userId, empresa_id: 'b8e4962e-7a3b-47b3-a945-3bcb9739881b', status: 'rascunho', payload: {} },
      ],
    }));
    expect(missingEmpresa.valid).toBe(false);
    expect(missingEmpresa.errors.some((error) => error.includes('gm_contracts[0].empresa_id não referencia uma empresa incluída'))).toBe(true);
  });

  it('rejects secret fields and datasets outside the allowlist', () => {
    const input = backupWith({
      clients: [{ id: clientId, empresa_id: companyId, token: 'must-not-import' }],
      platform_admins: [{ user_id: companyId }],
    });
    const preview = validateSystemBackup(input);

    expect(preview.valid).toBe(false);
    expect(preview.errors.some((error) => error.includes('Campo secreto'))).toBe(true);
    expect(preview.errors.some((error) => error.includes('Dataset não permitido'))).toBe(true);
  });

  it('rejects signature_envelopes whose signers lack private tokens', () => {
    const input = backupWith({
      signature_envelopes: [{
        id: 'c376f05e-c1df-4988-b6a3-d3706ec60f7e',
        owner_id: userId,
        payload: { signers: [{ nome: 'Fulano', email: 'a@b.com' }] },
      }],
    });
    const preview = validateSystemBackup(input);
    expect(preview.valid).toBe(false);
    expect(preview.errors.some((error) => error.includes('signatários sem token privado'))).toBe(true);
  });

  it('rejects references to records omitted from the backup', () => {
    const input = backupWith({
      contratos: [{ id: 'f0ea67ae-15f1-4fc8-91c2-5449f1d77be1', empresa_id: companyId, numero: 'C-1', cliente_id: clientId, servico_id: 'b8e4962e-7a3b-47b3-a945-3bcb9739881b' }],
    });
    const preview = validateSystemBackup(input);

    expect(preview.valid).toBe(false);
    expect(preview.errors.some((error) => error.includes('servico_id'))).toBe(true);
  });
});

describe('AdminSystemBackupService RPC error handling & sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  });

  it('sends clean datasets and returns RPC summary on restoreSystemBackup', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'is_platform_admin') return { data: true, error: null };
      if (fn === 'admin_restore_system_backup') return { data: { restored: true, recordCount: 2, inserted: { empresas: 1, clients: 1 } }, error: null };
      return { data: null, error: null };
    });

    const input = JSON.parse(`{
      "format": "${SYSTEM_BACKUP_FORMAT}",
      "version": ${SYSTEM_BACKUP_VERSION},
      "createdAt": "2026-10-23T00:00:00.000Z",
      "datasets": {
        ${SYSTEM_BACKUP_DATASETS.map((t) => {
          if (t === 'empresas') return `"empresas": [{"id": "${companyId}", "nome": "Empresa", "__proto__": {"polluted": true}}]`;
          if (t === 'clients') return `"clients": [{"id": "${clientId}", "empresa_id": "${companyId}", "nome": "Cliente", "documento": "12345678901"}]`;
          return `"${t}": []`;
        }).join(',')}
      },
      "exclusions": [],
      "redactions": []
    }`);

    const result = await AdminSystemBackupService.restoreSystemBackup(input, 'RESTAURAR E SUBSTITUIR DADOS');
    expect(result.restored).toBe(true);
    expect(result.recordCount).toBe(2);

    const restoreCall = rpcMock.mock.calls.find(([fn]) => fn === 'admin_restore_system_backup');
    expect(restoreCall).toBeDefined();
    const sentRow = restoreCall?.[1]?.p_datasets?.empresas?.[0];
    expect(Object.prototype.hasOwnProperty.call(sentRow, '__proto__')).toBe(false);
  });

  it('formats descriptive SQL error messages on restoreSystemBackup and clearSystemData', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'is_platform_admin') return { data: true, error: null };
      if (fn === 'admin_restore_system_backup') {
        return {
          data: null,
          error: {
            code: '23503',
            message: 'insert or update on table "agenda" violates foreign key constraint "agenda_responsavel_id_fkey"',
            details: 'Key (responsavel_id)=(00000000-0000-4000-8000-000000000001) is not present in table "profiles".',
            hint: 'Aplique a migration de restauração.',
          },
        };
      }
      if (fn === 'admin_clear_operational_data') {
        return {
          data: null,
          error: {
            code: '23514',
            message: 'new row for relation "marketing_projects" violates check constraint',
            details: 'Failing row contains (empresa_id=null, client_id=abc).',
          },
        };
      }
      return { data: null, error: null };
    });

    await expect(AdminSystemBackupService.restoreSystemBackup(backupWith(), 'RESTAURAR E SUBSTITUIR DADOS'))
      .rejects.toThrow(/A restauração foi cancelada:.*Violação de chave estrangeira.*Código SQL: 23503/s);

    await expect(AdminSystemBackupService.clearSystemData('APAGAR TODOS OS DADOS'))
      .rejects.toThrow(/A limpeza não foi realizada:.*restrição de validação.*Código SQL: 23514/s);
  });
});
