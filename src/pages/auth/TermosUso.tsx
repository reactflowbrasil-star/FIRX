import { Card } from '@/components/ui';
import { FileText } from 'lucide-react';

export default function TermosUso() {
  const sections = ['Identificacao', 'Aceitacao', 'Uso do servico', 'Conta do usuario', 'Propriedade intelectual', 'Limitacao de responsabilidade', 'Alteracoes', 'Contato'];
  return (
    <div className="min-h-screen bg-bg-secondary p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-text-primary text-center">Termos de Uso</h1>
        {sections.map((s) => (
          <Card key={s}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand" />
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
