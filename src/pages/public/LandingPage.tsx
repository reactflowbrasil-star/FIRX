import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Crown,
  FileArchive,
  FileSignature,
  FileText,
  Headset,
  Layers,
  MapPinned,
  MessageCircle,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { BRAND, getBrandWhatsAppUrl } from '@/lib/brand';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';

const heroPhrases = [
  'Cresça com controle.',
  'Organize cada oportunidade.',
  'Assine com mais agilidade.',
];

const features = [
  {
    icon: FileSignature,
    title: 'Contratos e assinaturas',
    desc: 'Crie documentos, envie para assinatura eletrônica e acompanhe cada etapa em um só lugar.',
  },
  {
    icon: Wallet,
    title: 'Financeiro organizado',
    desc: 'Acompanhe parcelas, recebimentos, comprovantes e pendências com visão clara da operação.',
  },
  {
    icon: Calendar,
    title: 'Agenda comercial',
    desc: 'Mantenha compromissos, visitas e próximos contatos sincronizados no ritmo da sua equipe.',
  },
  {
    icon: BarChart3,
    title: 'Indicadores e relatórios',
    desc: 'Veja o panorama financeiro, contratos ativos e movimentações recentes em tempo real.',
  },
  {
    icon: Users,
    title: 'Equipe comercial',
    desc: 'Gerencie vendedores, metas, comissões e mantenha a comunicação interna centralizada.',
  },
  {
    icon: MapPinned,
    title: 'Visitas e rotas',
    desc: 'Direcione atendimentos externos aos vendedores e acompanhe o trajeto autorizado.',
  },
  {
    icon: FileArchive,
    title: 'Arquivos e documentos',
    desc: 'Armazene anexos, comprovantes e PDFs ligados diretamente à rotina da empresa.',
  },
  {
    icon: Layers,
    title: 'Multiempresas e perfis',
    desc: 'Alterne empresas com facilidade e controle permissões por papel dentro da plataforma.',
  },
];

const modules = [
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    eyebrow: 'Relacionamento',
    title: 'Do primeiro contato ao histórico completo.',
    description: 'Centralize cadastros, contatos, documentos e observações importantes para toda a equipe trabalhar com contexto.',
    points: ['Cadastro de pessoas físicas e jurídicas', 'Busca rápida e filtros de carteira', 'Histórico conectado a contratos e agenda', 'Dados organizados por empresa'],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    icon: FileSignature,
    eyebrow: 'Documentos e assinaturas',
    title: 'Prepare, envie e acompanhe cada contrato.',
    description: 'Monte contratos comerciais com cálculos automáticos, acompanhe assinaturas eletrônicas e acesse PDFs com rastreabilidade.',
    points: ['Geração e edição assistida', 'Link individual de assinatura digital', 'Envio por WhatsApp e e-mail', 'Versionamento e histórico'],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: CircleDollarSign,
    eyebrow: 'Recebimentos',
    title: 'Saiba o que entrou e o que está previsto.',
    description: 'Controle parcelas, lançamentos, estornos e vencimentos para tomar decisões com base no caixa real.',
    points: ['Parcelas e previsões mensais', 'Alerta de pendências e atrasos', 'Anexo de comprovantes', 'Exportação em relatórios'],
  },
  {
    id: 'agenda',
    label: 'Agenda e visitas',
    icon: MapPinned,
    eyebrow: 'Equipe em campo',
    title: 'A agenda comercial conectada ao cliente.',
    description: 'Organize compromissos e direcione visitas ao vendedor. Ao iniciar a rota, a posição autorizada atualiza o painel.',
    points: ['Solicitações diretas ao vendedor', 'Status em tempo real', 'Rota até o cliente no mapa', 'Histórico de atendimentos'],
  },
  {
    id: 'equipe',
    label: 'Equipe',
    icon: Headset,
    eyebrow: 'Pessoas e comunicação',
    title: 'Cada pessoa com seu acesso e espaço próprio.',
    description: 'Convide colaboradores, acompanhe o desempenho de vendedores e centralize a comunicação da operação.',
    points: ['Perfis e permissões granulares', 'Área dedicada para vendedores', 'Regras de comissão e metas', 'Chat interno e notificações'],
  },
  {
    id: 'gestao',
    label: 'Gestão e segurança',
    icon: Shield,
    eyebrow: 'Visão administrativa',
    title: 'Transparência total sobre a operação.',
    description: 'Consulte indicadores consolidados, gerencie módulos multiempresas e acompanhe trilhas de auditoria.',
    points: ['Dashboard executivo e gráficos', 'Registros com data, hora e autor', 'Backup e governança administrativa', 'Controle de acesso por RLS'],
  },
];

type SubscriptionPlan = {
  id: 'free' | 'intermediario' | 'business';
  name: string;
  badge: string;
  contractLimit: string;
  priceLabel: string;
  priceDetail: string;
  description: string;
  features: string[];
  ctaLabel: string;
  featured?: boolean;
  to?: string;
  externalHref?: string;
};

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'FREE',
    badge: 'Para começar',
    contractLimit: 'Até 15 contratos',
    priceLabel: 'Gratuito',
    priceDetail: 'Sem cartão de crédito',
    description: 'Ideal para quem está estruturando a operação comercial e quer organizar os primeiros contratos.',
    features: [
      'Até 15 contratos cadastrados',
      'Cadastro de clientes e serviços',
      'Envio para assinatura eletrônica',
      'Agenda comercial e visão financeira básica',
    ],
    ctaLabel: 'Começar no FREE',
    to: '/cadastro?plano=free',
  },
  {
    id: 'intermediario',
    name: 'Intermediário',
    badge: 'Mais escolhido',
    contractLimit: 'Até 100 contratos',
    priceLabel: 'Para escalar',
    priceDetail: 'Operação comercial completa',
    description: 'Feito para empresas em crescimento que precisam de volume maior, equipe de vendas e controle recorrente.',
    features: [
      'Até 100 contratos na plataforma',
      'Todos os recursos do plano FREE',
      'Gestão de vendedores, metas e comissões',
      'Visitas em campo, financeiro e relatórios',
    ],
    ctaLabel: 'Escolher Intermediário',
    featured: true,
    to: '/cadastro?plano=intermediario',
  },
  {
    id: 'business',
    name: 'Business',
    badge: 'Sob medida',
    contractLimit: 'Acima de 100 contratos',
    priceLabel: 'Sob consulta',
    priceDetail: 'Atendimento direto no WhatsApp',
    description: 'Para operações de alto volume, múltiplas unidades e necessidades personalizadas de implantação.',
    features: [
      'Capacidade de contratos sob medida',
      'Todos os recursos do plano Intermediário',
      'Estrutura multiempresas e fluxos dedicados',
      'Implantação assistida e suporte prioritário',
    ],
    ctaLabel: 'Consultar no WhatsApp',
    externalHref: getBrandWhatsAppUrl('Olá! Gostaria de consultar o plano Business do firx.'),
  },
];

const workflow = [
  { number: '01', icon: Building2, title: 'Configure a empresa', text: 'Crie sua conta em segundos e reúna os dados principais da operação.' },
  { number: '02', icon: Users, title: 'Cadastre clientes e equipe', text: 'Importe sua base comercial e defina acessos para gestores e vendedores.' },
  { number: '03', icon: ClipboardCheck, title: 'Gere contratos e acompanhe', text: 'Emita documentos, envie links de assinatura e conecte agenda e visitas.' },
  { number: '04', icon: BarChart3, title: 'Decida com clareza', text: 'Acompanhe recebimentos, pendências e resultados financeiros em um único painel.' },
];

const faqs = [
  {
    q: 'Como funcionam os planos FREE, Intermediário e Business?',
    a: 'No plano FREE você utiliza o firx gratuitamente com limite de até 15 contratos. O plano Intermediário amplia a capacidade para até 100 contratos com foco em equipes em crescimento. Para demandas acima de 100 contratos ou configurações sob medida, o plano Business é contratado sob consulta diretamente pelo WhatsApp.',
  },
  {
    q: 'O firx funciona no celular?',
    a: 'Sim. A interface é responsiva para celular, tablet e computador, além de permitir instalação como aplicativo (PWA) em navegadores compatíveis.',
  },
  {
    q: 'Como os vendedores acessam o sistema?',
    a: 'O administrador cadastra o vendedor e envia o link de ativação. Após definir a senha, o vendedor entra em um painel exclusivo para visitas, metas e rotas.',
  },
  {
    q: 'Os clientes precisam criar conta para assinar um contrato?',
    a: 'Não. O cliente acessa o documento através do link exclusivo enviado pela empresa e realiza a assinatura digital diretamente no navegador.',
  },
];

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);

function ProductPreview() {
  return (
    <div data-float className="relative mx-auto w-full max-w-[34rem] lg:ml-auto" aria-hidden="true">
      <div aria-hidden="true" className="absolute -inset-6 rounded-[2.5rem] bg-brand/12 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border-color bg-bg-primary p-4 shadow-xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-border-color pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/12 text-brand">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Painel executivo</p>
              <p className="text-sm font-semibold text-text-primary">Visão da operação</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1 text-[11px] font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Ao vivo
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 py-4 sm:gap-4">
          <div className="rounded-2xl bg-bg-secondary p-3.5 sm:p-4">
            <p className="text-xs text-text-secondary">A receber no mês</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">R$ 42.380</p>
            <p className="mt-1 text-[11px] font-medium text-brand">Fluxo financeiro claro</p>
          </div>
          <div className="rounded-2xl bg-bg-secondary p-3.5 sm:p-4">
            <p className="text-xs text-text-secondary">Contratos ativos</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">24</p>
            <p className="mt-1 text-[11px] font-medium text-text-secondary">Plano Intermediário</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-color p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Evolução de contratos</p>
              <p className="text-xs text-text-secondary">Acompanhamento semanal</p>
            </div>
            <span className="rounded-lg bg-bg-secondary px-2.5 py-1 text-[11px] font-medium text-text-secondary">Este mês</span>
          </div>
          <svg aria-hidden="true" viewBox="0 0 420 116" className="h-24 w-full overflow-visible">
            <defs>
              <linearGradient id="landing-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.24" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 94H420M0 58H420M0 22H420" stroke="var(--border-color)" strokeDasharray="4 6" />
            <path d="M0 91 C42 85 55 73 84 78 S137 67 168 70 S212 42 252 51 S301 35 334 42 S382 15 420 17 L420 116 L0 116Z" fill="url(#landing-chart-fill)" />
            <path d="M0 91 C42 85 55 73 84 78 S137 67 168 70 S212 42 252 51 S301 35 334 42 S382 15 420 17" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="334" cy="42" r="5" fill="var(--brand)" stroke="var(--bg-primary)" strokeWidth="3" />
          </svg>
          <div className="flex justify-between pt-1 text-[10px] text-text-secondary">
            <span>Sem 1</span>
            <span>Sem 2</span>
            <span>Sem 3</span>
            <span>Sem 4</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-bg-secondary/80 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"><Check className="h-4 w-4" /></span>
            <span className="truncate text-xs font-medium text-text-primary">Assinaturas acompanhadas</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-bg-secondary/80 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"><ShieldCheck className="h-4 w-4" /></span>
            <span className="truncate text-xs font-medium text-text-primary">Dados em um só ambiente</span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2.5 rounded-2xl border border-border-color bg-bg-primary px-4 py-3 shadow-xl sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 text-brand"><Sparkles className="h-4 w-4" /></span>
        <span>
          <span className="block text-xs font-semibold text-text-primary">FREE · Intermediário · Business</span>
          <span className="block text-[11px] text-text-secondary">Planos para cada fase da empresa</span>
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [activeModule, setActiveModule] = useState(modules[0]);

  const scrollToSection = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }
    gsap.to(window, { duration: 0.85, ease: 'power3.inOut', scrollTo: { y: target, offsetY: 84 } });
  };

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.landing-hero-copy > *', { y: 24, opacity: 0, duration: 0.75, stagger: 0.08, ease: 'power3.out', delay: 0.1 });
      gsap.from('[data-hero-visual]', { y: 32, opacity: 0, scale: 0.97, duration: 0.9, ease: 'power3.out', delay: 0.22 });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.from(element, {
          y: 28,
          opacity: 0,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 90%', once: true },
        });
      });
      gsap.to('[data-parallax]', {
        yPercent: -16,
        ease: 'none',
        scrollTrigger: { trigger: '.gradient-hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.to('[data-float]', { y: -8, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
    return () => media.revert();
  }, { scope: pageRef });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedPhrase(heroPhrases[0]);
      return;
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const phrase = heroPhrases[phraseIndex];
      if (!phrase) return;
      characterIndex += deleting ? -1 : 1;
      setTypedPhrase(phrase.slice(0, characterIndex));

      if (!deleting && characterIndex >= phrase.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1700);
        return;
      }
      if (deleting && characterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % heroPhrases.length;
        timer = window.setTimeout(tick, 380);
        return;
      }
      timer = window.setTimeout(tick, deleting ? 32 : 72);
    };
    timer = window.setTimeout(tick, 220);
    return () => window.clearTimeout(timer);
  }, []);

  const phraseParts = typedPhrase.split(/(\s+)/);
  let wordIndex = -1;

  return (
    <div ref={pageRef} className="min-h-screen overflow-x-clip bg-transparent text-text-primary">
      <header className="glass sticky top-0 z-50 border-b border-border-color/70">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center" aria-label={`${BRAND.name} — início`}>
            <BrandLogo linkTo={false} heightClass="h-12 sm:h-14" className="max-w-[min(48vw,220px)] object-left sm:max-w-[250px]" />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-6 lg:flex">
            <a href="#recursos" onClick={scrollToSection('recursos')} className="text-sm font-medium text-text-secondary transition-colors hover:text-brand">Recursos</a>
            <a href="#modulos" onClick={scrollToSection('modulos')} className="text-sm font-medium text-text-secondary transition-colors hover:text-brand">Módulos</a>
            <a href="#planos" onClick={scrollToSection('planos')} className="text-sm font-medium text-text-secondary transition-colors hover:text-brand">Planos</a>
            <a href="#como-funciona" onClick={scrollToSection('como-funciona')} className="text-sm font-medium text-text-secondary transition-colors hover:text-brand">Como funciona</a>
            <a href="#seguranca" onClick={scrollToSection('seguranca')} className="text-sm font-medium text-text-secondary transition-colors hover:text-brand">Segurança</a>
          </nav>
          <nav aria-label="Acesso" className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm" className="px-3 sm:px-4">Entrar</Button></Link>
            <Link to="/cadastro"><Button size="sm" className="gap-1.5 px-3 sm:px-4">Começar grátis <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Button></Link>
          </nav>
        </div>
        <nav aria-label="Atalhos da landing page" className="border-t border-border-color/50 px-4 py-2 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <a href="#recursos" onClick={scrollToSection('recursos')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Recursos</a>
            <a href="#modulos" onClick={scrollToSection('modulos')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Módulos</a>
            <a href="#planos" onClick={scrollToSection('planos')} className="py-1 text-xs font-semibold text-brand">Planos</a>
            <a href="#como-funciona" onClick={scrollToSection('como-funciona')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Como funciona</a>
            <a href="#seguranca" onClick={scrollToSection('seguranca')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Segurança</a>
            <a href="#duvidas" onClick={scrollToSection('duvidas')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Dúvidas</a>
          </div>
        </nav>
      </header>

      <main>
        <section id="inicio" className="gradient-hero relative isolate overflow-hidden">
          <div data-parallax aria-hidden="true" className="pointer-events-none absolute -inset-y-16 -right-16 -z-10 w-[70%] bg-[radial-gradient(ellipse_42%_50%_at_85%_42%,rgba(130,10,209,0.10),transparent_75%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-[14%] -z-10 h-64 w-64 rounded-full border border-brand/10" />
          <div aria-hidden="true" className="pointer-events-none absolute right-[12%] top-[18%] -z-10 h-48 w-48 rounded-full border border-brand/10" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[1.04fr_.96fr] lg:gap-12 lg:px-8 lg:py-24">
            <div className="landing-hero-copy mx-auto w-full max-w-2xl text-center lg:mx-0 lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-surface px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> GESTÃO COMERCIAL E FINANCEIRA
              </div>
              <h1 className="font-display text-[clamp(2.55rem,7.2vw,5.3rem)] font-light leading-[0.98] tracking-[-0.06em] text-text-primary">
                Mais clareza.
                <br />
                <span className="sr-only">{typedPhrase || heroPhrases[0]}</span>
                <span aria-hidden="true" className="text-gradient">
                  {phraseParts.map((part, index) => {
                    if (/^\s+$/.test(part)) return <span key={index}>{part}</span>;
                    wordIndex += 1;
                    return <span key={index} className={wordIndex % 2 === 1 ? 'font-bold' : 'font-light'}>{part}</span>;
                  })}
                  <span className="ml-0.5 inline-block h-[0.76em] w-[2px] translate-y-1 bg-brand align-baseline motion-safe:animate-pulse" />
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8 lg:mx-0">
                Contratos, assinaturas, agenda e financeiro conectados em uma experiência limpa para você escalar do primeiro contrato ao alto volume.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link to="/cadastro" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full gap-2 sm:w-auto">
                    Começar no plano FREE <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#planos" onClick={scrollToSection('planos')} className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Ver planos e limites
                  </Button>
                </a>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <InstallPwaButton className="w-full sm:w-auto" />
                <Link to="/auth" className="text-sm font-semibold text-brand transition-colors hover:text-brand-hover">
                  Já tenho conta →
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2.5 text-xs font-medium text-text-secondary sm:text-sm lg:justify-start">
                {['FREE até 15 contratos', 'Intermediário até 100 contratos', 'Business via WhatsApp'].map((label) => (
                  <span key={label} className="inline-flex items-center gap-1.5"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand" />{label}</span>
                ))}
              </div>
            </div>
            <div data-hero-visual><ProductPreview /></div>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Tudo conectado</p>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] text-text-primary sm:text-4xl">
              Uma rotina mais simples, <span className="font-bold">do contrato ao recebimento.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base sm:leading-7">
              Menos planilhas espalhadas. Mais previsibilidade e controle sobre cada negociação.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <article key={feature.title} data-reveal className="h-full">
                <div className="card-premium group relative h-full overflow-hidden p-5 sm:p-6">
                  <div aria-hidden="true" className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand/5 blur-2xl transition-colors group-hover:bg-brand/15" />
                  <span className="relative mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/12 text-brand transition-transform duration-200 group-hover:scale-105">
                    <feature.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-brand">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="relative text-base font-semibold tracking-tight text-text-primary">{feature.title}</h3>
                  <p className="relative mt-2 text-sm leading-6 text-text-secondary">{feature.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="planos" className="scroll-mt-24 border-y border-border-color/70 bg-bg-secondary py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Planos transparentes</p>
              <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] text-text-primary sm:text-4xl">
                Escolha o plano ideal para o <span className="font-bold">ritmo da sua empresa.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base sm:leading-7">
                Comece gratuitamente com até 15 contratos, avance para até 100 no plano Intermediário ou monte uma estrutura sob medida no Business.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
              {subscriptionPlans.map((plan) => {
                const isFeatured = Boolean(plan.featured);
                const isBusiness = plan.id === 'business';
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col justify-between rounded-[1.75rem] border p-6 transition-[transform,border-color,box-shadow] duration-200 sm:p-8 ${
                      isFeatured
                        ? 'border-brand bg-bg-primary shadow-xl ring-1 ring-brand/25 lg:-translate-y-1'
                        : 'border-border-color bg-bg-primary shadow-sm hover:border-brand/40 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-xl font-bold tracking-tight text-text-primary">{plan.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                            isFeatured
                              ? 'bg-brand text-white'
                              : 'bg-brand-surface text-brand'
                          }`}
                        >
                          {isFeatured && <Crown className="h-3 w-3" aria-hidden="true" />}
                          {plan.badge}
                        </span>
                      </div>

                      <div className="mt-5 rounded-2xl border border-border-color/80 bg-bg-secondary p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Capacidade</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-brand sm:text-[1.65rem]">
                          {plan.contractLimit}
                        </p>
                        <div className="mt-2 flex flex-wrap items-baseline gap-2 border-t border-border-color/70 pt-2 text-xs">
                          <span className="font-semibold text-text-primary">{plan.priceLabel}</span>
                          <span className="text-text-secondary">· {plan.priceDetail}</span>
                        </div>
                      </div>

                      <p className="mt-5 text-sm leading-6 text-text-secondary">{plan.description}</p>

                      <ul className="mt-6 space-y-3 border-t border-border-color/70 pt-5">
                        {plan.features.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm text-text-primary">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8">
                      {plan.to ? (
                        <Link to={plan.to} className="block w-full">
                          <Button
                            size="lg"
                            variant={isFeatured ? 'primary' : 'outline'}
                            className="w-full gap-2"
                          >
                            {plan.ctaLabel}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </Link>
                      ) : (
                        <a
                          href={plan.externalHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full"
                        >
                          <Button
                            size="lg"
                            variant={isBusiness ? 'outline' : 'primary'}
                            className="w-full gap-2 border-brand/40 text-brand hover:bg-brand-surface/70"
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            {plan.ctaLabel}
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="modulos" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div data-reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Uma operação conectada</p>
              <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] sm:text-4xl">
                Explore os módulos do <span className="font-bold">firx.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                Selecione uma área para ver como cada fluxo conecta equipe comercial, contratos e financeiro.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-8">
              <div data-reveal className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 lg:content-start">
                {modules.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    aria-pressed={activeModule.id === module.id}
                    onClick={() => setActiveModule(module)}
                    className={`flex min-h-16 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all duration-150 sm:gap-3 sm:px-4 ${
                      activeModule.id === module.id
                        ? 'border-brand bg-brand/10 text-brand shadow-sm'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:border-brand/40 hover:bg-brand/5'
                    }`}
                  >
                    <module.icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true" />
                    <span>{module.label}</span>
                  </button>
                ))}
              </div>
              <article key={activeModule.id} className="relative min-h-[340px] overflow-hidden rounded-[1.75rem] border border-border-color bg-bg-primary p-5 shadow-lg sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-surface px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
                      <activeModule.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {activeModule.eyebrow}
                    </span>
                    <span className="hidden text-xs font-medium text-text-secondary sm:block">
                      {String(modules.findIndex((module) => module.id === activeModule.id) + 1).padStart(2, '0')} / 06
                    </span>
                  </div>
                  <h3 className="max-w-xl text-2xl font-semibold leading-tight tracking-tight text-text-primary sm:text-3xl">{activeModule.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">{activeModule.description}</p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {activeModule.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm text-text-secondary">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/cadastro" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand transition-all hover:gap-3">
                    Comece sua conta <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div data-reveal className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Comece com clareza</p>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] sm:text-4xl">
              Uma rotina simples, <span className="font-bold">etapa por etapa.</span>
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((step) => (
              <article key={step.number} data-reveal className="h-full">
                <div className="group h-full rounded-2xl border border-border-color bg-bg-primary p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[0.18em] text-brand">{step.number}</span>
                    <step.icon className="h-5 w-5 text-brand" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="seguranca" className="scroll-mt-24 bg-[#171321] py-16 text-white sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div data-reveal>
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-light">Acesso organizado</p>
              <h2 className="max-w-xl text-3xl font-light leading-tight tracking-[-0.045em] text-white sm:text-4xl">
                Cada pessoa vê o que precisa para trabalhar.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                Perfis, regras de acesso e auditoria mantêm a operação protegida enquanto sua equipe cresce entre os planos FREE, Intermediário e Business.
              </p>
              <Link to="/privacidade" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-white">
                Conheça a política de privacidade <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: BadgeCheck, title: 'Perfis por função', text: 'Acesso alinhado ao papel de cada usuário.' },
                { icon: MapPinned, title: 'GPS sob permissão', text: 'Localização vinculada apenas à rota iniciada pelo vendedor.' },
                { icon: MessageCircle, title: 'Atualizações em tempo real', text: 'Visitas e conversas sincronizadas com o painel.' },
                { icon: FileArchive, title: 'Histórico organizado', text: 'Documentos, contratos e trilhas de auditoria protegidos.' },
              ].map((item) => (
                <div key={item.title} data-reveal className="flex h-full gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-light" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-white/70">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="duvidas" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div data-reveal className="mb-8 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Perguntas frequentes</p>
            <h2 className="font-display text-3xl font-light tracking-[-0.045em] sm:text-4xl">Antes de começar.</h2>
          </div>
          <div className="space-y-2.5">
            {faqs.map((item) => (
              <details
                key={item.q}
                data-reveal
                className="group rounded-2xl border border-border-color bg-bg-primary px-4 open:border-brand/40 open:shadow-sm sm:px-5"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-brand transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="max-w-3xl pb-4 pr-8 text-sm leading-6 text-text-secondary">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-border-color bg-bg-primary px-6 py-12 text-center shadow-md sm:px-10 sm:py-16">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_100%_at_50%_100%,rgba(130,10,209,0.08),transparent_80%)]" />
            <div className="relative mx-auto max-w-2xl">
              <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-surface text-brand">
                <FileText aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] text-text-primary sm:text-4xl">
                Pronto para ter <span className="font-bold">mais clareza?</span>
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base sm:leading-7">{BRAND.tagline}</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/cadastro" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full gap-2 sm:w-auto">
                    Começar agora <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href={getBrandWhatsAppUrl('Olá! Quero saber mais sobre o plano Business do firx.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    Falar no WhatsApp (Business)
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-color/80 bg-bg-primary py-7">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-text-secondary sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo linkTo={false} heightClass="h-11 sm:h-12" className="max-w-[180px] object-left opacity-90" />
            <span className="text-xs sm:text-sm">© 2027 {BRAND.name}</span>
          </div>
          <nav aria-label="Informações legais" className="flex items-center gap-5 text-xs sm:text-sm">
            <a href="#planos" onClick={scrollToSection('planos')} className="transition-colors hover:text-text-primary">Planos</a>
            <Link to="/termos" className="transition-colors hover:text-text-primary">Termos</Link>
            <Link to="/privacidade" className="transition-colors hover:text-text-primary">Privacidade</Link>
          </nav>
        </div>
        <div className="mx-auto mt-5 flex w-full max-w-7xl flex-col items-center justify-center gap-1 border-t border-border-color/60 px-4 pt-4 text-center text-xs text-text-secondary sm:px-6 lg:px-8">
          <p className="w-full text-center">© 2027 {BRAND.name}. Todos os direitos reservados.</p>
          <p className="w-full text-center">
            Desenvolvido por{' '}
            <a href="https://agenciaafrica.com.br" target="_blank" rel="noopener noreferrer" className="font-semibold text-text-primary transition-colors hover:text-brand">
              Agência AFRICA
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
