/** Identidade oficial firx */
export const BRAND = {
  name: 'firx',
  shortName: 'firx',
  product: 'firx Software',
  tagline: 'Gestão financeira inteligente para empresas que crescem',
  logo: `${import.meta.env.BASE_URL}assets/logo-firx-wordmark-white.png`,
  logoUrl: `${import.meta.env.BASE_URL}assets/logo-firx-wordmark-white.png`,
  logoLight: `${import.meta.env.BASE_URL}assets/logo-firx-wordmark.png`,
  logoIcon: `${import.meta.env.BASE_URL}assets/logo-firx-icon.png`,
  logoIconDark: `${import.meta.env.BASE_URL}assets/logo-firx-icon-white.png`,
  site: 'https://agenciaafrica.com.br/firx',
  colors: {
    primary: '#820AD1',
    primaryHover: '#490B75',
    primaryDark: '#290B4D',
    purpleLight: '#AA68FF',
    purpleSurface: '#EADBF1',
    ink: '#171321',
    surface: '#FFFFFF',
    background: '#F4F4F4',
  },
} as const;
