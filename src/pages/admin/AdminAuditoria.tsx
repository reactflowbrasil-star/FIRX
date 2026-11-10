import { RefreshCw, Shield } from 'lucide-react';
import { Button, Card, PageHeader, Badge, EmptyState } from '@/components/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCallback, useEffect, useState } from 'react';
import { getRecentAdminAuditEvents } from '@/services/admin-audit-service';
import type { AdminAuditEvent } from '@/repositories/admin-audit-repository';

export default function AdminAuditoria() {
  const { session } = useAdminAuth();
  const [logs, setLogs] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await getRecentAdminAuditEvents());
    } catch (queryError: unknown) {
      setError(queryError instanceof Error ? queryError.message : 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, session?.id]);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-5">
      <PageHeader
        title="Auditoria"
        description="Eventos administrativos da plataforma"
        actions={<Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={() => void load()}>Atualizar</Button>}
      />
      {error && <p role="alert" className="rounded-lg border border-erro/30 bg-erro/10 px-3 py-2 text-sm text-erro">{error}</p>}
      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-text-secondary">Carregando eventos…</p>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Sem eventos"
              description="Ainda não há eventos disponíveis para esta sessão."
              icon={<Shield className="w-6 h-6" />}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border-color">
            {logs.map((l) => (
              <li
                key={l.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                <Badge variant="info" className="self-start sm:self-auto shrink-0">{l.action}</Badge>
                <p className="text-sm flex-1 min-w-0 break-all">
                  {l.email || 'Administrador'}
                  {l.details && Object.keys(l.details).length > 0 ? ` · ${JSON.stringify(l.details)}` : ''}
                </p>
                <span className="text-xs text-text-secondary sm:text-right sm:shrink-0">
                  {l.created_at && !Number.isNaN(new Date(l.created_at).getTime())
                    ? new Date(l.created_at).toLocaleString('pt-BR')
                    : 'Horário não disponível'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
