import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let authListener: ((event: string, session: unknown) => void) | null = null;
  const unsubscribe = vi.fn();
  const getSession = vi.fn();
  const signInWithPassword = vi.fn();
  const signOut = vi.fn();
  const rpc = vi.fn();
  const from = vi.fn();

  return {
    getAuthListener: () => authListener,
    setAuthListener: (cb: ((event: string, session: unknown) => void) | null) => {
      authListener = cb;
    },
    unsubscribe,
    getSession,
    signInWithPassword,
    signOut,
    rpc,
    from,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        mocks.setAuthListener(cb);
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      }),
    },
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

vi.mock('@/services/file-storage', () => ({
  criarLinkArquivo: vi.fn().mockResolvedValue(undefined),
}));

import { AuthProvider, useAuth } from './AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.setAuthListener(null);
  });

  it('preserves existing profile nome and avoids duplicate company creation during concurrent SIGNED_IN', async () => {
    const profileUpsert = vi.fn();
    const empresaInsert = vi.fn();
    const session = {
      access_token: 'tok-1',
      expires_at: 999999,
      user: {
        id: 'user-1',
        email: 'ana@empresa.com',
        user_metadata: { full_name: 'Meta Name' },
      },
    };

    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === 'is_platform_admin') return Promise.resolve({ data: false, error: null });
      if (fn === 'is_marketing_member') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'user-1',
                    nome: 'Nome Personalizado',
                    email: 'ana@empresa.com',
                    role: 'admin',
                    avatar_url: null,
                  },
                  error: null,
                }),
            }),
          }),
          upsert: profileUpsert,
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'empresa_members') {
        return {
          select: (cols: string) => ({
            eq: () => ({
              eq: () =>
                cols.includes('empresas')
                  ? Promise.resolve({
                      data: [
                        {
                          empresa_id: 'emp-1',
                          role: 'admin',
                          empresas: { id: 'emp-1', nome: 'Empresa Alpha', cnpj: null },
                        },
                      ],
                      error: null,
                    })
                  : {
                      limit: () => Promise.resolve({ data: [{ id: 'mem-1' }], error: null }),
                    },
            }),
          }),
        };
      }
      if (table === 'empresas') {
        return { insert: empresaInsert };
      }
      return {
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Trigger concurrent SIGNED_IN event while initial hydration runs
    await act(async () => {
      mocks.getAuthListener()?.('SIGNED_IN', session);
      await new Promise((r) => setTimeout(r, 20));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.nome).toBe('Nome Personalizado');
    expect(result.current.empresaAtiva?.id).toBe('emp-1');
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(empresaInsert).not.toHaveBeenCalled();
  });

  it('does not misclassify a marketing-only user without companies as vendedor', async () => {
    const session = {
      access_token: 'tok-2',
      expires_at: 999999,
      user: { id: 'mkt-1', email: 'mkt@agencia.com', user_metadata: { nome: 'Mkt User' } },
    };

    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === 'is_platform_admin') return Promise.resolve({ data: false, error: null });
      if (fn === 'is_marketing_member') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: null,
                  error: null,
                }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'empresa_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isMarketingMember).toBe(true);
    expect(result.current.empresaAtiva).toBeNull();
    expect(result.current.user?.role).not.toBe('vendedor');
  });
});
