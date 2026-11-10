import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { BrandLogo } from './BrandLogo';

function ThemeToggleHelper() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      theme:{theme}
    </button>
  );
}

describe('BrandLogo', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('uses colored logo in light mode and white logo in dark mode', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <BrandLogo linkTo={false} centered />
          <ThemeToggleHelper />
        </ThemeProvider>
      </MemoryRouter>
    );

    const img = screen.getByAltText('firx') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('logo-firx-wordmark.png');
    expect(img.className).toContain('object-contain');
    expect(img.className).toContain('mx-auto');

    fireEvent.click(screen.getByRole('button', { name: /theme:light/i }));
    expect((screen.getByAltText('firx') as HTMLImageElement).getAttribute('src')).toContain(
      'logo-firx-wordmark-white.png'
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('uses compact icon variants when compact is true', () => {
    window.localStorage.setItem('theme', 'dark');
    render(
      <MemoryRouter>
        <ThemeProvider>
          <BrandLogo linkTo={false} compact />
        </ThemeProvider>
      </MemoryRouter>
    );

    const img = screen.getByAltText('firx') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('logo-firx-icon-white.png');
  });
});
