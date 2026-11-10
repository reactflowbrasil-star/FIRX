import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstVisitIntro } from './FirstVisitIntro';

vi.mock('gsap', () => ({
  gsap: {
    timeline: () => ({
      set: function () { return this; },
      to: function () { return this; },
      kill: vi.fn(),
    }),
  },
}));

describe('FirstVisitIntro', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    document.body.style.overflow = '';
  });

  it('can be skipped immediately without blocking navigation and unlocks body scroll', () => {
    render(<FirstVisitIntro />);

    const skipButton = screen.getByRole('button', { name: /pular apresentação/i });
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(skipButton);

    expect(screen.queryByRole('button', { name: /pular apresentação/i })).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(window.sessionStorage.getItem('growmoney-first-visit-intro-session-v2')).toBe('complete');
  });

  it('dismisses on Escape key', () => {
    render(<FirstVisitIntro />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('status')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
