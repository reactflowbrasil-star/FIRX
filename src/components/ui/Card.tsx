import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, header, footer, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-bg-primary border border-border-color rounded-2xl shadow-sm transition-[box-shadow,border-color] duration-normal',
        paddings[padding],
        className
      )}
    >
      {header && (
        <div className={cn('border-b border-border-color', padding !== 'none' && 'pb-3.5 mb-4')}>
          {header}
        </div>
      )}
      {children}
      {footer && (
        <div className={cn('border-t border-border-color', padding !== 'none' && 'pt-3.5 mt-4')}>
          {footer}
        </div>
      )}
    </div>
  );
}
