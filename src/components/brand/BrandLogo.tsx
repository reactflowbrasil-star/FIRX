import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useTheme } from '@/contexts/ThemeContext';

type BrandLogoProps = {
  heightClass?: string;
  className?: string;
  linkTo?: string | false;
  compact?: boolean;
};

export function BrandLogo({
  heightClass = 'h-[84px]',
  className,
  linkTo = '/',
  compact = false,
}: BrandLogoProps) {
  const { theme } = useTheme();
  const src = compact ? BRAND.logoIcon : theme === 'light' ? BRAND.logoLight : BRAND.logo;
  const img = (
    <img
      src={src}
      alt={BRAND.name}
      className={cn(
        heightClass,
        'w-auto object-contain select-none',
        compact ? 'max-w-[44px] object-center' : className?.includes('mx-auto') ? 'max-w-full object-center' : 'max-w-full object-left',
        className
      )}
      decoding="async"
    />
  );

  if (linkTo === false) return img;

  return (
    <Link to={linkTo} className="inline-flex items-center shrink-0" aria-label={BRAND.name}>
      {img}
    </Link>
  );
}
