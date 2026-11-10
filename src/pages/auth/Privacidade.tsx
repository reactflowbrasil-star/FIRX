import { Card } from '@/components/ui';
import { Shield } from 'lucide-react';

export default function Privacidade() {
  const sections = ['Informacoes coletadas', 'Uso', 'Compartilhamento', 'Seguranca', 'Direitos do usuario', 'Cookies', 'Alteracoes', 'Contato'];
  return (
    <div className="min-h-screen bg-bg-secondary p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-text-primary text-center">Politica de Privacidade</h1>
        {sections.map((s) => (
          <Card key={s}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand" />
                {s}
              </h2>
              <p className="text-text-secondary">Conteudo da secao {s}.</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
