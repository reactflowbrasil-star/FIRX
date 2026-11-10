import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useTheme } from '@/contexts/ThemeContext';

type BrandLogoProps = {
  heightClass?: string;
  className?: string;
  linkTo?: string | false;
  compact?: boolean;
  centered?: boolean;
};

export function BrandLogo({
  heightClass = 'h-12',
  className,
  linkTo = '/',
  compact = false,
  centered = false,
}: BrandLogoProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isCentered = centered || Boolean(className?.includes('mx-auto'));
  const src = compact
    ? isDark
      ? BRAND.logoIconDark
      : BRAND.logoIcon
    : isDark
      ? BRAND.logo
      : BRAND.logoLight;

  const img = (
    <img
      src={src}
      alt={BRAND.name}
      className={cn(
        heightClass,
        'block w-auto shrink-0 object-contain select-none transition-opacity duration-fast',
        compact
          ? 'max-w-[52px] object-center'
          : isCentered
            ? 'max-w-full mx-auto object-center'
            : 'max-w-full object-left',
        className
      )}
      decoding="async"
    />
  );

  if (linkTo === false) {
    return isCentered ? <div className="flex w-full min-w-0 justify-center">{img}</div> : img;
  }

  return (
    <Link
      to={linkTo}
      className={cn('inline-flex items-center shrink-0', isCentered && 'mx-auto justify-center')}
      aria-label={BRAND.name}
    >
      {img}
    </Link>
  );
}
