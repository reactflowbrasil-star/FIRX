import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import { criarLinkArquivo } from '@/services/file-storage';
import { hasPermission as checkPermission, ROLES, type Role } from '@/lib/permissions';
import type { UserSession, Empresa } from '@/lib/auth-types';

interface AuthContextValue {
  user: UserSession | null;
  empresas: Empresa[];
  empresaAtiva: Empresa | null;
  isMarketingMember: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserSession>;
  register: (nome: string, email: string, senha: string, empresaNome: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchEmpresa: (empresaId: string) => void;
  refreshEmpresas: () => Promise<void>;
  updateProfile: (nome: string, avatarPath?: string | null) => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata || {};
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.nome as string) ||
    (user.email ? user.email.split('@')[0] : 'Usuario')
  );
}

function getAuthCallbackUrl() {
  const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL('auth/callback', appBaseUrl).toString();
}

function readSavedEmpresaId(): string | null {
  try {
    return window.localStorage.getItem('empresaAtiva');
  } catch {
    return null;
  }
}

function writeSavedEmpresaId(empresaId: string | null) {
  try {
    if (empresaId) window.localStorage.setItem('empresaAtiva', empresaId);
    else window.localStorage.removeItem('empresaAtiva');
  } catch {
    // Ignore storage quota / private-mode restrictions.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaAtiva, setEmpresaAtiva] = useState<Empresa | null>(null);
  const [isMarketingMember, setIsMarketingMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const authEpochRef = useRef(0);
  const hydrationInFlightRef = useRef<{ userId: string; promise: Promise<UserSession> } | null>(null);

  const fetchUserCompanies = useCallback(async (userId: string): Promise<Empresa[]> => {
    try {
      const { data, error } = await supabase
        .from('empresa_members')
        .select(`empresa_id, role, empresas (id, nome, cnpj)`)
        .eq('usuario_id', userId)
        .eq('status', 'aceito');

      if (error) {
        console.warn('Falha ao carregar empresas:', error.message);
        return [];
      }

      return (data || []).map((m: any) => ({
        id: m.empresas?.id ?? m.empresa_id,
        nome: m.empresas?.nome ?? 'Empresa',
        cnpj: m.empresas?.cnpj ?? null,
        role: m.role,
      }));
    } catch (err) {
      console.warn('Erro ao carregar empresas', err);
      return [];
    }
  }, []);

  const ensureProfileAndEmpresa = useCallback(
    async (authUser: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      const nome = displayNameFromUser(authUser);
      const email = authUser.email || '';

      const { data: existingProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id, nome, email, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profileLookupError && !existingProfile) {
        await supabase
          .from('profiles')
          .upsert({ id: authUser.id, email, nome }, { onConflict: 'id', ignoreDuplicates: true });
      } else if (existingProfile && email && existingProfile.email !== email) {
        await supabase.from('profiles').update({ email }).eq('id', authUser.id);
      }

      // A global platform admin is provisioned server-side and does not need a
      // tenant created as a side effect of opening the admin dashboard.
      const { data: isGlobalAdmin, error: globalAdminError } = await supabase.rpc('is_platform_admin');
      if (globalAdminError || isGlobalAdmin === true) return;

      // Agency-only accounts should not receive an unrelated commercial tenant.
      const { data: marketingMember, error: marketingMembershipError } = await supabase.rpc('is_marketing_member');
      if (marketingMembershipError || marketingMember === true) return;

      // Never auto-provision a tenant when membership lookup fails or the user is a seller.
      if (existingProfile?.role === 'vendedor') return;

      const { data: memberships, error: membershipsError } = await supabase
        .from('empresa_members')
        .select('id')
        .eq('usuario_id', authUser.id)
        .eq('status', 'aceito')
        .limit(1);

      if (membershipsError || (memberships && memberships.length > 0)) return;

      const { data: vendorRecord, error: vendorError } = await supabase
        .from('vendedores')
        .select('id')
        .eq('usuario_id', authUser.id)
        .limit(1);

      if (vendorError || (vendorRecord && vendorRecord.length > 0)) return;

      const empresaNome =
        (authUser.user_metadata?.empresa as string) ||
        `${nome.split(' ')[0]} · Empresa`;

      const { data: novaEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome: empresaNome,
          responsavel_id: authUser.id,
          configuracoes: {},
        })
        .select('*')
        .single();

      if (empresaError) {
        console.warn('empresa OAuth:', empresaError.message);
        return;
      }

      if (novaEmpresa) {
        await supabase.from('empresa_members').insert({
          empresa_id: novaEmpresa.id,
          usuario_id: authUser.id,
          role: 'admin',
          status: 'aceito',
          aceito_em: new Date().toISOString(),
        });
      }
    },
    []
  );

  const runHydration = useCallback(
    async (
      session: {
        user: {
          id: string;
          email?: string | null;
          user_metadata?: Record<string, unknown>;
        };
        access_token: string;
        expires_at?: number;
      },
      epoch: number
    ): Promise<UserSession> => {
      await ensureProfileAndEmpresa(session.user);

      const [
        { data: profile },
        { data: isGlobalAdmin },
        { data: marketingMember, error: marketingError },
        loadedEmpresas,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase.rpc('is_platform_admin'),
        supabase.rpc('is_marketing_member'),
        fetchUserCompanies(session.user.id),
      ]);

      const savedId = readSavedEmpresaId();
      const activeEmpresa =
        loadedEmpresas.find((empresa) => empresa.id === savedId) || loadedEmpresas[0] || null;
      const isMarketing = !marketingError && marketingMember === true;
      const fallbackRole =
        isGlobalAdmin === true
          ? 'admin'
          : (profile?.role as UserSession['role'] | undefined) || 'operador';
      const avatar = profile?.avatar_url
        ? await criarLinkArquivo(profile.avatar_url, 60 * 60).catch(() => undefined)
        : undefined;

      const sessionUser: UserSession = {
        id: session.user.id,
        email: session.user.email || profile?.email || '',
        nome: profile?.nome || displayNameFromUser(session.user),
        avatar_url: profile?.avatar_url || null,
        avatar,
        // Application permissions follow the active tenant membership, while a
        // platform admin defaults to 'admin' instead of falling back to 'vendedor'.
        role: (activeEmpresa?.role || fallbackRole) as UserSession['role'],
        empresa_id: activeEmpresa?.id || null,
        empresas: loadedEmpresas.map(({ id, nome, role }) => ({
          id,
          nome,
          role: role || 'vendedor',
        })),
        token: session.access_token,
        expira_em: String(session.expires_at || ''),
      };

      if (mountedRef.current && epoch === authEpochRef.current) {
        setEmpresas(loadedEmpresas);
        setEmpresaAtiva(activeEmpresa);
        writeSavedEmpresaId(activeEmpresa?.id || null);
        setIsMarketingMember(isMarketing);
        setUser(sessionUser);
      }

      return sessionUser;
    },
    [ensureProfileAndEmpresa, fetchUserCompanies]
  );

  const hydrateFromSession = useCallback(
    (session: {
      user: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      };
      access_token: string;
      expires_at?: number;
    }) => {
      const existing = hydrationInFlightRef.current;
      if (existing && existing.userId === session.user.id) {
        return existing.promise;
      }
      const epoch = authEpochRef.current;
      const promise = runHydration(session, epoch).finally(() => {
        if (hydrationInFlightRef.current?.promise === promise) {
          hydrationInFlightRef.current = null;
        }
      });
      hydrationInFlightRef.current = { userId: session.user.id, promise };
      return promise;
    },
    [runHydration]
  );

  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (session?.user) {
          await hydrateFromSession(session as any);
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessao', err);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      if (event === 'SIGNED_OUT' || !session) {
        authEpochRef.current += 1;
        hydrationInFlightRef.current = null;
        setUser(null);
        setEmpresas([]);
        setEmpresaAtiva(null);
        setIsMarketingMember(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Defer outside Supabase's auth callback to avoid v2 lock contention.
        window.setTimeout(() => {
          if (!mountedRef.current) return;
          void hydrateFromSession(session as any).catch((e) => {
            console.warn('hydrate auth', e);
          });
        }, 0);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [hydrateFromSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<UserSession> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(`Falha ao autenticar: ${error.message}`);
      if (!data.session) throw new Error('Sessão não criada');
      return hydrateFromSession(data.session as any);
    },
    [hydrateFromSession]
  );

  const loginWithGoogle = useCallback(async () => {
    const redirectTo = getAuthCallbackUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw new Error(error.message || 'Falha ao iniciar login com Google');
  }, []);

  const register = useCallback(
    async (nome: string, email: string, senha: string, empresaNome: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, empresa: empresaNome }, emailRedirectTo: getAuthCallbackUrl() },
      });
      if (error) throw new Error(error.message || 'Falha ao registrar');
      if (!data.user) throw new Error('Usuário não retornado após cadastro');

      if (!data.session) {
        throw new Error(
          'Conta criada. Verifique seu e-mail para confirmar o cadastro e depois faça login.'
        );
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        nome,
      });
      if (profileError) {
        console.warn('profiles upsert:', profileError.message);
      }

      const { data: novaEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome: empresaNome,
          responsavel_id: data.user.id,
          configuracoes: {},
        })
        .select('*')
        .single();

      if (empresaError) {
        throw new Error(`Conta criada, mas falha ao criar empresa: ${empresaError.message}`);
      }

      if (novaEmpresa) {
        const { error: memberError } = await supabase.from('empresa_members').insert({
          empresa_id: novaEmpresa.id,
          usuario_id: data.user.id,
          role: 'admin',
          status: 'aceito',
          aceito_em: new Date().toISOString(),
        });
        if (memberError) {
          console.warn('empresa_members:', memberError.message);
        }
      }

      const session: UserSession = {
        id: data.user.id,
        email,
        nome,
        role: 'admin',
        empresa_id: novaEmpresa?.id || null,
        empresas: novaEmpresa
          ? [{ id: novaEmpresa.id, nome: empresaNome, role: 'admin' }]
          : [],
        token: data.session?.access_token || '',
        expira_em: String(data.session?.expires_at || ''),
      };

      setIsMarketingMember(false);
      setUser(session);
      if (novaEmpresa) {
        const emp: Empresa = {
          id: novaEmpresa.id,
          nome: empresaNome,
          cnpj: null,
          role: 'admin',
        };
        setEmpresaAtiva(emp);
        setEmpresas([emp]);
        writeSavedEmpresaId(novaEmpresa.id);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    authEpochRef.current += 1;
    hydrationInFlightRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setEmpresas([]);
    setEmpresaAtiva(null);
    setIsMarketingMember(false);
    writeSavedEmpresaId(null);
  }, []);

  const switchEmpresa = useCallback(
    (empresaId: string) => {
      const empresa = empresas.find((e) => e.id === empresaId);
      if (empresa) {
        setEmpresaAtiva(empresa);
        setUser((current) => current ? {
          ...current,
          role: (empresa.role || 'operador') as UserSession['role'],
          empresa_id: empresa.id,
        } : current);
        writeSavedEmpresaId(empresaId);
      }
    },
    [empresas]
  );

  const refreshEmpresas = useCallback(async () => {
    if (!user) return;
    const loadedEmpresas = await fetchUserCompanies(user.id);
    const active =
      loadedEmpresas.find((empresa) => empresa.id === empresaAtiva?.id) ||
      loadedEmpresas.find((empresa) => empresa.id === readSavedEmpresaId()) ||
      loadedEmpresas[0] ||
      null;

    setEmpresas(loadedEmpresas);
    setEmpresaAtiva(active);
    writeSavedEmpresaId(active?.id || null);

    if (active) {
      setUser((current) => current ? {
        ...current,
        role: (active.role || 'operador') as UserSession['role'],
        empresa_id: active.id,
        empresas: loadedEmpresas.map(({ id, nome, role }) => ({ id, nome, role: role || 'vendedor' })),
      } : current);
    } else {
      setUser((current) => current ? {
        ...current,
        role: current.role === 'admin' ? 'admin' : 'operador',
        empresa_id: null,
        empresas: [],
      } : current);
    }
  }, [user, empresaAtiva?.id, fetchUserCompanies]);

  const updateProfile = useCallback(async (nome: string, avatarPath?: string | null) => {
    if (!user) throw new Error('Entre na sua conta para atualizar o perfil.');
    const updates: { nome: string; avatar_url?: string | null } = { nome: nome.trim() };
    if (avatarPath !== undefined) updates.avatar_url = avatarPath;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Não foi possível salvar o perfil: ${error.message}`);
    if (!data) throw new Error('Perfil não encontrado ou sem permissão para alterá-lo.');

    const path = updates.avatar_url === undefined ? user.avatar_url : updates.avatar_url;
    const avatar = path ? await criarLinkArquivo(path, 60 * 60).catch(() => undefined) : undefined;
    setUser((current) => current ? { ...current, nome: updates.nome, avatar_url: path, avatar } : current);
  }, [user]);

  const refreshAvatar = useCallback(async () => {
    if (!user?.avatar_url) return;
    const avatar = await criarLinkArquivo(user.avatar_url, 60 * 60).catch(() => undefined);
    setUser((current) => current?.id === user.id ? { ...current, avatar } : current);
  }, [user?.id, user?.avatar_url]);

  useEffect(() => {
    if (!user?.avatar_url) return;
    void refreshAvatar();
    const interval = window.setInterval(() => void refreshAvatar(), 50 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refreshAvatar, user?.avatar_url]);

  const hasPermissionCb = useCallback(
    (permission: string) => {
      const role = empresaAtiva?.role || user?.role;
      if (!role || !(role in ROLES)) return false;
      return checkPermission(role as Role, permission as any);
    },
    [empresaAtiva?.role, user?.role]
  );

  const value: AuthContextValue = {
    user,
    empresas,
    empresaAtiva,
    isMarketingMember,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    switchEmpresa,
    refreshEmpresas,
    updateProfile,
    hasPermission: hasPermissionCb,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

