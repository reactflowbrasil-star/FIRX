import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        'bg-brand text-white hover:bg-brand-hover shadow-sm hover:shadow-md btn-glow active:scale-[0.98]',
      secondary:
        'bg-brand-surface text-brand-dark hover:bg-brand-surface/80 dark:text-brand-light active:scale-[0.98]',
      outline:
        'border border-border-color bg-bg-primary text-text-primary hover:bg-bg-secondary hover:border-brand/40 active:scale-[0.98]',
      ghost:
        'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
      danger:
        'bg-erro text-white hover:bg-erro/90 shadow-sm active:scale-[0.98]',
    };

    const sizes = {
      sm: 'px-3.5 py-1.5 text-xs rounded-xl gap-1.5 min-h-[34px]',
      md: 'px-4 py-2.5 text-sm rounded-xl gap-2 min-h-[44px]',
      lg: 'px-6 py-3 text-base rounded-2xl gap-2.5 min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-fast',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary',
          'disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
