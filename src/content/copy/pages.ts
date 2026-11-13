const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'

export const pagesCopy = {
  home: { title: 'Home', heading: 'Vocelo', body: lorem },
  pricing: { title: 'Pricing', heading: 'Pricing', body: lorem },
  privacy: { title: 'Privacy', heading: 'Privacy Policy', body: lorem },
  terms: { title: 'Terms', heading: 'Terms of Service', body: lorem },
  footer: {
    privacy: 'Privacy',
    terms: 'Terms',
    contact: 'Contact support',
    supportEmail: 'support@vocelo.app',
  },
} as const
