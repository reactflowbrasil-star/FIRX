import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  success: 'bg-sucesso/12 text-sucesso',
  warning: 'bg-aviso/12 text-aviso',
  danger: 'bg-erro/12 text-erro',
  info: 'bg-informacao/12 text-informacao',
  neutral: 'bg-bg-tertiary text-text-secondary',
  brand: 'bg-brand-surface text-brand-dark dark:text-brand-light',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
