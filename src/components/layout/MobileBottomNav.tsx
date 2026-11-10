import { NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';

export function MobileBottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const items = [
    ...navItems,
    ...(isAdmin ? [{ label: 'Painel Admin', href: '/admin', icon: ShieldCheck }] : []),
  ];

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-40 min-w-0',
        'border-t border-border-color bg-bg-primary/95 backdrop-blur-md',
        'safe-pb'
      )}
      aria-label="Navegação principal"
    >
      <div className="mobile-nav-scroll overflow-x-auto overscroll-x-contain">
        <ul className="flex h-16 w-max min-w-full px-1">
          {items.map((item) => (
            <li key={item.href} className="w-[76px] shrink-0">
              <NavLink
                to={item.href}
                end={item.href === '/dashboard'}
                aria-label={item.label}
                className={({ isActive }) => cn(
                  'flex h-full flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-medium transition-colors duration-fast pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  isActive ? 'text-brand font-semibold' : 'text-text-secondary',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-fast',
                        isActive && 'bg-brand-surface text-brand'
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0"
                        strokeWidth={isActive ? 2.4 : 1.9}
                      />
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
