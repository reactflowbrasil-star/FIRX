import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  format?: 'currency' | 'number' | 'percent';
  icon?: ReactNode;
}

function formatValue(value: number, format?: 'currency' | 'number' | 'percent'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }
  if (format === 'percent') {
    return `${value >= 0 ? '+' : ''}${value}%`;
  }
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function KPICard({ label, value, change, changeType = 'neutral', format, icon }: KPICardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <div
      className={cn(
        'card-premium p-5',
        'flex flex-col gap-3'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary sm:text-sm">{label}</span>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-brand-surface flex items-center justify-center text-brand shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-text-primary tabular-nums">
          {formatValue(value, format)}
        </p>
        {change !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-full',
              isPositive && 'bg-sucesso/12 text-sucesso',
              isNegative && 'bg-erro/12 text-erro',
              changeType === 'neutral' && 'bg-bg-tertiary text-text-secondary'
            )}
            aria-label={`Mudança de ${change >= 0 ? '+' : ''}${change}%`}
          >
            {change >= 0 ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}
