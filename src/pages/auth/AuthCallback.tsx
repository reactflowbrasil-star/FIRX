import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const oauthError =
          params.get('error_description') ||
          hashParams.get('error_description') ||
          params.get('error') ||
          hashParams.get('error');
        if (oauthError) {
          throw new Error(oauthError);
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          const code = params.get('code');
          const tokenHash = params.get('token_hash');
          const otpType = params.get('type') || hashParams.get('type');
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          } else if (tokenHash && otpType) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: otpType as EmailOtpType,
            });
            if (verifyError) throw verifyError;
          }
        }

        const {
          data: { session: s2 },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (s2) {
          const flow = params.get('flow');
          const callbackType = params.get('type') || hashParams.get('type');
          if (flow === 'vendor-activation') {
            navigate('/recuperar-senha?redefinir=1&flow=vendor-activation', { replace: true });
            return;
          }
          if (flow === 'marketing-activation') {
            navigate('/recuperar-senha?redefinir=1&flow=marketing-activation', { replace: true });
            return;
          }
          if (callbackType === 'recovery' || callbackType === 'invite') {
            navigate('/recuperar-senha?redefinir=1', { replace: true });
            return;
          }
          navigate('/dashboard', { replace: true });
        } else {
          setError('Não foi possível concluir o login. Tente novamente.');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro no retorno da autenticação.');
        }
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-transparent p-4">
      <BrandLogo
        linkTo={false}
        centered
        heightClass="h-16 sm:h-[72px]"
        className="opacity-95 max-w-[min(100%,240px)]"
      />
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-sm text-erro max-w-sm" role="alert">{error}</p>
          <button
            type="button"
            className="text-sm font-medium text-brand hover:underline"
            onClick={() => navigate('/auth', { replace: true })}
          >
            Voltar ao login
          </button>
        </div>
      ) : (
        <>
          <LoadingSpinner />
          <p className="text-sm text-text-secondary">Concluindo autenticação…</p>
        </>
      )}
    </div>
  );
}

