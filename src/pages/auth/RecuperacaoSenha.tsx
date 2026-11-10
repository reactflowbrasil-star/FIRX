import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { supabase } from '@/lib/supabase/client';

export default function RecuperacaoSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetMode = searchParams.get('redefinir') === '1';
  const flow = searchParams.get('flow');
  const vendorActivation = flow === 'vendor-activation';
  const marketingActivation = flow === 'marketing-activation';
  const isActivation = vendorActivation || marketingActivation;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (resetMode) {
        if (password.length < 8) throw new Error('A nova senha deve ter pelo menos 8 caracteres.');
        if (password !== confirmation) throw new Error('As senhas não coincidem.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        if (vendorActivation) {
          const { data, error: notificationError } = await supabase.functions.invoke('smtp-mailer', {
            body: { action: 'notify_vendor_activated' },
          });
          const notificationFailed =
            notificationError ||
            data?.notifications?.some((result: { notified?: boolean }) => !result.notified);
          setNotice(
            notificationFailed
              ? 'Senha definida e cadastro ativado. O envio do aviso ao administrador ficou pendente.'
              : 'Senha definida e cadastro ativado. Você já pode acessar a área do vendedor.'
          );
          redirectTimerRef.current = window.setTimeout(
            () => navigate('/vendedor', { replace: true }),
            1800
          );
        } else if (marketingActivation) {
          setNotice('Senha definida e acesso ativado. Redirecionando para a equipe de Marketing...');
          redirectTimerRef.current = window.setTimeout(
            () => navigate('/marketing', { replace: true }),
            1500
          );
        } else {
          setNotice('Senha alterada. Você já pode entrar com a nova senha.');
          redirectTimerRef.current = window.setTimeout(
            () => navigate('/auth', { replace: true }),
            1200
          );
        }
      } else {
        if (!email.trim()) throw new Error('Informe o e-mail da sua conta.');
        const base = new URL(import.meta.env.BASE_URL, window.location.origin);
        const redirectTo = new URL('recuperar-senha?redefinir=1', base).toString();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (resetError) throw resetError;
        setNotice('Se existir uma conta para este e-mail, enviaremos o link de redefinição.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível concluir a solicitação.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center overflow-x-clip bg-transparent px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-border-color bg-bg-primary p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex flex-col items-center space-y-2.5 text-center">
          <BrandLogo
            linkTo="/"
            centered
            heightClass="h-16 sm:h-[72px]"
            className="mx-auto max-w-[min(100%,240px)]"
          />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {isActivation ? 'Ative seu cadastro' : resetMode ? 'Definir nova senha' : 'Recuperar senha'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {vendorActivation
                ? 'Crie uma senha para concluir a ativação da sua conta de vendedor.'
                : marketingActivation
                  ? 'Crie uma senha para acessar a Central de Marketing.'
                  : resetMode
                    ? 'Escolha uma senha segura para sua conta.'
                    : 'Enviaremos instruções para seu e-mail.'}
            </p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {resetMode ? (
            <>
              <Input
                label="Nova senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Input
                label="Confirme a senha"
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </>
          ) : (
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              autoComplete="email"
              required
            />
          )}
          {error && <p className="text-sm text-erro" role="alert">{error}</p>}
          {notice && <p className="text-sm font-medium text-brand" role="status">{notice}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            {isActivation ? 'Definir senha e ativar cadastro' : resetMode ? 'Alterar senha' : 'Enviar instruções'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link to="/auth" className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover hover:underline">
            <ArrowLeft className="h-4 w-4" /> Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}
