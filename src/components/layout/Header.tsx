import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Search, Menu, LogOut, Settings, User, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { LiveChatTrigger } from '@/components/chat/LiveChat';

interface HeaderProps {
  onMenuToggle: () => void;
  onSearch?: (query: string) => void;
  user?: { name: string; email: string; avatar?: string };
  notifications?: Array<{ id: string; title: string; time: string; read: boolean }>;
  onNotificationRead?: (id: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  chatUnreadCount?: number;
  onOpenChat?: () => void;
  onLogout?: () => void;
}

export function Header({
  onMenuToggle,
  onSearch,
  user,
  notifications = [],
  onNotificationRead,
  soundEnabled = true,
  onToggleSound,
  chatUnreadCount = 0,
  onOpenChat,
  onLogout,
}: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { isAdmin } = useAdminAuth();
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => setAvatarFailed(false), [user?.avatar]);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-16 flex items-center gap-2 md:gap-4 px-4 md:px-6',
        'bg-bg-primary/95 backdrop-blur-md border-b border-border-color'
      )}
    >
      <button
        onClick={onMenuToggle}
        className="p-2.5 rounded-xl text-text-primary hover:bg-bg-secondary pressable focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <Link to="/dashboard" className="flex items-center shrink-0 md:hidden" aria-label={BRAND.name}>
        <BrandLogo linkTo={false} heightClass="h-11" className="max-w-[min(42vw,160px)]" />
      </Link>

      <div className="flex-1 max-w-md mx-auto hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar no sistema…"
            onChange={(e) => onSearch?.(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 text-sm rounded-xl',
              'bg-bg-secondary border border-border-color',
              'text-text-primary placeholder:text-text-secondary',
              'hover:border-brand/30 focus:bg-bg-primary focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand',
              'transition-all duration-fast'
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {isAdmin && (
          <Link
            to="/admin"
            className="hidden sm:inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-3.5 text-xs font-semibold text-white shadow-sm transition-colors duration-fast hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Abrir painel administrativo"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Painel Admin</span>
          </Link>
        )}
        {onOpenChat && (
          <LiveChatTrigger
            unreadCount={chatUnreadCount}
            onClick={() => {
              setNotifOpen(false);
              setProfileOpen(false);
              onOpenChat();
            }}
          />
        )}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="p-2.5 rounded-xl text-text-primary hover:bg-bg-secondary relative pressable transition-colors"
            aria-label="Notificações"
            aria-haspopup="menu"
            aria-expanded={notifOpen}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand rounded-full ring-2 ring-bg-primary" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-bg-primary border border-border-color rounded-2xl shadow-lg py-2 z-50 animate-modal">
              <div className="flex items-center justify-between border-b border-border-color px-4 py-2.5">
                <h3 className="text-sm font-semibold text-text-primary">Atualizações</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-brand-surface px-2.5 py-0.5 text-[11px] font-semibold text-brand-dark dark:text-brand-light">
                      {unreadCount} novas
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                    aria-label={soundEnabled ? 'Desativar som das notificações' : 'Ativar som das notificações'}
                    title={soundEnabled ? 'Som ativado' : 'Som desativado'}
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-text-secondary text-center">Sem notificações</p>
              ) : (
                <div className="max-h-80 overflow-y-auto" role="menu" aria-label="Atualizações recentes">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onNotificationRead?.(n.id)}
                      role="menuitem"
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-bg-secondary border-b border-border-color last:border-0 transition-colors',
                        !n.read && 'bg-brand-surface/35'
                      )}
                    >
                      <p className="flex items-start gap-2 text-sm text-text-primary">
                        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} />
                        {n.title}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 pl-3.5">{n.time}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl hover:bg-bg-secondary pressable transition-colors"
            aria-label="Perfil"
          >
            {user?.avatar && !avatarFailed ? (
              <img src={user.avatar} alt={user.name} onError={() => setAvatarFailed(true)} className="w-8 h-8 rounded-full object-cover border border-border-color" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span className="hidden md:block text-sm font-medium text-text-primary max-w-[120px] truncate">
              {user?.name || 'Usuário'}
            </span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-bg-primary border border-border-color rounded-2xl shadow-lg py-2 z-50 animate-modal">
              <div className="px-4 py-2.5 border-b border-border-color">
                <p className="text-sm font-semibold text-text-primary truncate">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-text-secondary truncate">{user?.email || ''}</p>
              </div>
              <Link
                to="/perfil"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
              >
                <User className="w-4 h-4" /> Meu perfil
              </Link>
              <Link
                to="/configuracoes"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
              >
                <Settings className="w-4 h-4" /> Configurações
              </Link>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-erro hover:bg-erro/10 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
