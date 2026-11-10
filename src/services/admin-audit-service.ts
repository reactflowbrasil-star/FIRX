import { listAdminAuditEvents, type AdminAuditEvent } from '@/repositories/admin-audit-repository';

export async function getRecentAdminAuditEvents(): Promise<AdminAuditEvent[]> {
  try {
    return await listAdminAuditEvents(100);
  } catch (cause) {
    const detail = cause instanceof Error && cause.message ? ` (${cause.message})` : '';
    throw new Error(`Não foi possível carregar a auditoria. Verifique o acesso administrativo e as políticas aplicadas.${detail}`);
  }
}
