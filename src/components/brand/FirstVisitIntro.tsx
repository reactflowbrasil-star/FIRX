import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { BRAND } from '@/lib/brand';

// A persistent localStorage flag suppresses the intro on every future visit.
// Keep completion scoped to this tab session so a fresh app entry can show it.
const INTRO_STORAGE_KEY = 'growmoney-first-visit-intro-session-v2';

function wasIntroCompleted() {
  try {
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === 'complete';
  } catch {
    return false;
  }
}

function markIntroCompleted() {
  try {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'complete');
  } catch {
    // Keep the introduction usable when browser storage is unavailable.
  }
}

function shouldSkipIntroOnCurrentRoute() {
  if (typeof window === 'undefined') return true;
  const path = window.location.pathname;
  return (
    path.includes('/auth/callback') ||
    path.includes('/recuperar-senha') ||
    path.includes('/assinar/')
  );
}

export function FirstVisitIntro() {
  const [visible, setVisible] = useState(() => !wasIntroCompleted() && !shouldSkipIntroOnCurrentRoute());
  const overlayRef = useRef<HTMLDivElement>(null);
  const growLogoRef = useRef<HTMLDivElement>(null);
  const agencyLogoRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const finishIntro = useCallback(() => {
    timelineRef.current?.kill();
    timelineRef.current = null;
    markIntroCompleted();
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const overlay = overlayRef.current;
    const growLogo = growLogoRef.current;
    const agencyLogo = agencyLogoRef.current;
    if (!overlay || !growLogo || !agencyLogo) {
      finishIntro();
      return;
    }

    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finishIntro();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeDuration = reducedMotion ? 0.15 : 0.55;
    const holdDuration = 3 - fadeDuration * 2;
    const fallbackTimer = window.setTimeout(finishIntro, reducedMotion ? 2500 : 8500);

    try {
      const timeline = gsap.timeline({
        onComplete: finishIntro,
      });
      timelineRef.current = timeline;

      timeline
        .set([growLogo, agencyLogo], { autoAlpha: 0, y: reducedMotion ? 0 : 12, scale: reducedMotion ? 1 : 0.97 })
        .to(growLogo, { autoAlpha: 1, y: 0, scale: 1, duration: fadeDuration, ease: 'power2.out' })
        .to({}, { duration: holdDuration })
        .to(growLogo, { autoAlpha: 0, y: reducedMotion ? 0 : -8, duration: fadeDuration, ease: 'power2.in' })
        .to(agencyLogo, { autoAlpha: 1, y: 0, scale: 1, duration: fadeDuration, ease: 'power2.out' })
        .to({}, { duration: holdDuration })
        .to(agencyLogo, { autoAlpha: 0, y: reducedMotion ? 0 : -8, duration: fadeDuration, ease: 'power2.in' })
        .to(overlay, { yPercent: -100, duration: reducedMotion ? 0.01 : 0.95, ease: 'power3.inOut' });
    } catch {
      finishIntro();
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('keydown', onKeyDown);
      timelineRef.current?.kill();
      timelineRef.current = null;
      document.body.style.overflow = priorOverflow;
    };
  }, [finishIntro, visible]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] grid h-[100svh] w-full place-items-center overflow-hidden bg-white text-slate-950"
      role="status"
      aria-label="Apresentação inicial do firx e da Agência AFRICA"
    >
      <button
        type="button"
        onClick={finishIntro}
        aria-label="Pular apresentação"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 min-h-10 rounded-xl border border-slate-200 bg-white/90 px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#820AD1]"
      >
        Pular
      </button>
      <div className="relative grid w-full place-items-center px-6">
        <div ref={growLogoRef} className="col-start-1 row-start-1 opacity-0" aria-hidden="true">
          <img
            src={BRAND.logoLight}
            alt="firx"
            className="h-auto max-h-[22svh] w-auto max-w-[min(78vw,380px)] object-contain"
            decoding="async"
          />
        </div>
        <div
          ref={agencyLogoRef}
          className="col-start-1 row-start-1 flex flex-col items-center opacity-0"
          role="img"
          aria-label="Agência AFRICA"
        >
          <span className="font-sans text-[clamp(2.75rem,10vw,5.5rem)] font-black leading-none tracking-[-0.075em] text-[#171321]">
            AFRICA
          </span>
          <span className="mt-3 h-1 w-24 rounded-full bg-[#820AD1]" aria-hidden="true" />
          <span className="mt-3 font-sans text-sm font-semibold uppercase tracking-[0.42em] text-[#666666] sm:text-base">
            Agência
          </span>
        </div>
      </div>
    </div>
  );
}
