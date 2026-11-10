import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '@/components/ui';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BRAND } from '@/lib/brand';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user, empresas, isMarketingMember, isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('auth-layout-active');
    return () => document.body.classList.remove('auth-layout-active');
  }, []);

  useEffect(() => {
    if (isLoading || adminLoading || !isAuthenticated) return;
    if (!isAdmin && user?.role === 'vendedor') {
      navigate('/vendedor', { replace: true });
      return;
    }
    if (!isAdmin && isMarketingMember && empresas.length === 0) {
      navigate('/marketing', { replace: true });
      return;
    }
    navigate('/dashboard', { replace: true });
  }, [isAuthenticated, isLoading, adminLoading, isAdmin, user?.role, isMarketingMember, empresas.length, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Erro ao entrar. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen w-full flex items-center justify-center bg-transparent overflow-x-clip px-3 py-[max(.5rem,env(safe-area-inset-top))] pb-[max(.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3">
      <Card className="auth-card w-full max-w-md !border-border-color !bg-bg-primary !shadow-lg p-5 sm:p-7 md:p-8">
        <div className="auth-brand flex flex-col items-center text-center mb-5 space-y-2.5">
          <BrandLogo linkTo={false} centered heightClass="h-16 sm:h-[72px]" className="auth-logo mx-auto max-w-[min(100%,240px)]" />
          <p className="auth-tagline text-text-secondary text-xs leading-5">{BRAND.tagline}</p>
        </div>

        <GoogleButton label="Entrar com Google" className="auth-google" />

        <div className="auth-divider relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-color" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-bg-primary px-2 text-text-secondary">ou e-mail</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form space-y-3">
          <Input
            type="email"
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Senha"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="rounded-md p-0.5 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="text-sm text-erro" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>

        <div className="auth-footer mt-4 text-center text-sm">
          <Link to="/recuperar-senha" className="font-medium text-brand hover:text-brand-hover hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <div className="auth-footer mt-1.5 text-center text-sm text-text-secondary">
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-brand hover:text-brand-hover hover:underline">
            Cadastre-se
          </Link>
        </div>
        <InstallPwaButton className="auth-pwa mt-3 w-full" />
      </Card>
    </main>
  );
}

