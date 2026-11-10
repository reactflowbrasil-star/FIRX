/** Identidade oficial firx */
export const BRAND = {
  name: 'firx',
  shortName: 'firx',
  product: 'firx Software',
  tagline: 'Gestão financeira inteligente para empresas que crescem',
  logo: `${import.meta.env.BASE_URL}logo-firx.svg`,
  logoUrl: `${import.meta.env.BASE_URL}logo-firx.svg`,
  logoLight: `${import.meta.env.BASE_URL}logo-firx-dark.svg`,
  logoIcon: `${import.meta.env.BASE_URL}logo-firx-icon.svg`,
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
