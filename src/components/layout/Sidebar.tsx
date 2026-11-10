import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  prominent?: boolean;
}

interface SidebarProps {
  items: NavItem[];
  user?: { name: string; email: string; avatar?: string };
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  /** When true, renders relative (for mobile drawer) instead of fixed */
  embedded?: boolean;
}

export function Sidebar({
  items,
  user,
  collapsed = false,
  onCollapse,
  embedded = false,
}: SidebarProps) {
  const location = useLocation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isCollapsed = embedded ? false : collapsed;

  useEffect(() => setAvatarFailed(false), [user?.avatar]);

  const toggleCollapse = () => {
    onCollapse?.(!collapsed);
  };

  const handleNavClick = () => {
    if (embedded) {
      onCollapse?.(false);
    }
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-bg-primary border-r border-border-color',
        'transition-[width] duration-normal ease-out',
        embedded
          ? 'relative h-full w-full'
          : cn('fixed left-0 top-0 z-40 h-screen', isCollapsed ? 'w-24' : 'w-72')
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          'flex items-center border-b border-border-color gap-2 shrink-0',
          isCollapsed ? 'h-16 px-2 justify-center' : 'h-20 px-5'
        )}
      >
        <BrandLogo
          linkTo={false}
          compact={isCollapsed}
          centered={isCollapsed}
          heightClass={isCollapsed ? 'h-10' : 'h-12 sm:h-14'}
          className={cn('transition-all duration-normal', isCollapsed ? 'max-w-[44px]' : 'max-w-[200px] object-left')}
        />
        {!isCollapsed && !embedded && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="ml-auto p-2 rounded-xl text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors pressable"
            aria-label="Recolher menu"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {isCollapsed && !embedded && (
        <button
          type="button"
          onClick={toggleCollapse}
          className="mx-auto mt-3 p-2 rounded-xl text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
          aria-label="Expandir menu"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {items.map((item) => {
          const active =
            location.pathname === item.href ||
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-fast',
                item.prominent
                  ? 'bg-brand text-white shadow-sm hover:bg-brand-hover'
                  : active
                    ? 'nav-link-active'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary pressable',
                isCollapsed && 'justify-center px-2'
              )}
              title={item.label}
            >
              <span className={cn('shrink-0', item.prominent && 'text-white')}>{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              {!isCollapsed && item.badge && (
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-surface text-brand-dark dark:text-brand-light">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {user && !isCollapsed && (
        <div className="border-t border-border-color p-4 safe-pb">
          <div className="flex items-center gap-3 rounded-xl bg-bg-secondary/70 p-2.5">
            {user.avatar && !avatarFailed ? (
              <img src={user.avatar} alt={user.name} onError={() => setAvatarFailed(true)} className="w-9 h-9 rounded-full object-cover shrink-0 border border-border-color" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brand-surface text-brand flex items-center justify-center text-sm font-bold shrink-0">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
              <p className="text-xs text-text-secondary truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
