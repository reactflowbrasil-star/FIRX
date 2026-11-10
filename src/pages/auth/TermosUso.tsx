import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BRAND } from '@/lib/brand';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermosUso() {
  const sections = [
    'Identificação',
    'Aceitação',
    'Uso do serviço',
    'Conta do usuário',
    'Propriedade intelectual',
    'Limitação de responsabilidade',
    'Alterações',
    'Contato',
  ];
  return (
    <main className="min-h-dvh bg-transparent p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo linkTo="/" centered heightClass="h-12 sm:h-14" className="max-w-[200px]" />
          <h1 className="text-3xl font-bold text-text-primary">Termos de Uso — {BRAND.name}</h1>
          <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <ArrowLeft className="w-4 h-4" /> Voltar ao login
          </Link>
        </div>
        {sections.map((s) => (
          <Card key={s}>
            <div className="p-2 sm:p-4">
              <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand" />
                {s}
              </h2>
              <p className="text-text-secondary">
                Diretrizes e condições aplicáveis à seção {s} na plataforma {BRAND.name}.
              </p>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
