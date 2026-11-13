const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'

export const pagesCopy = {
  home: { title: 'Home', heading: 'Vocelo', body: lorem },
  landing: {
    cta: { signedOut: 'Sign in with Buffer', signedIn: 'Open Vocelo' },
    hero: { headline: 'Vocelo', subhead: lorem },
    problem: { heading: 'The problem', body: lorem },
    solution: { heading: 'The solution', body: lorem },
    how: {
      heading: 'How it works',
      steps: [
        { title: 'Write', body: lorem },
        { title: 'Save as a Buffer draft', body: lorem },
        { title: 'Hear it', body: lorem },
      ],
    },
    personas: { heading: 'Hear it from different readers' },
    channels: {
      heading: 'Supported channels',
      // Plan facts belong in src/content/plans.ts (not built yet); see assumptions.md.
      items: [
        'LinkedIn',
        'X',
        'Substack Notes',
        'Threads',
        'Bluesky',
        'Mastodon',
      ],
    },
    pricing: { heading: 'Pricing' },
    faq: {
      heading: 'FAQ',
      items: [
        { question: 'Does this change my Buffer drafts?', answer: lorem },
        { question: 'What happens to my posts on Free?', answer: lorem },
      ],
    },
  },
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
