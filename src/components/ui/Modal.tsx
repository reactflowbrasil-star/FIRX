import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      dialog.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-0 sm:p-4">
      <button
        type="button"
        aria-label="Fechar janela"
        className="absolute inset-0 bg-grafite-dark/65 backdrop-blur-sm transition-opacity duration-normal"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'animate-modal relative flex min-h-0 w-full flex-col overflow-hidden border border-border-color bg-bg-primary shadow-xl focus:outline-none',
          'h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl',
          sizeClasses[size]
        )}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-color px-4 py-3.5 sm:px-6 sm:py-4">
          <h2 className="min-w-0 break-words text-base font-semibold text-text-primary sm:text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-color bg-bg-secondary/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6 sm:py-4 [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
