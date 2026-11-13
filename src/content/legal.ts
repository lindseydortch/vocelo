// DRAFT for human review (H8). Plain-language text written by an agent; not
// legal advice and not yet reviewed. Update `lastUpdated` whenever it changes.
import { pagesCopy } from './copy'

export type LegalSection = {
  heading: string
  paragraphs?: readonly string[]
  items?: readonly string[]
}

export type LegalDoc = {
  title: string
  heading: string
  lastUpdated: string
  sections: readonly LegalSection[]
}

const email = pagesCopy.footer.supportEmail

const privacy: LegalDoc = {
  title: 'Privacy',
  heading: 'Privacy Policy',
  lastUpdated: '2026-11-13',
  sections: [
    {
      heading: 'What this covers',
      paragraphs: [
        'Vocelo lets you write a post, save it as a Buffer draft, and hear it read aloud by different personas. This page explains what we store, who helps us run the service, and how to get your data deleted.',
      ],
    },
    {
      heading: 'What we store',
      items: [
        'Your Buffer account ID, email address and name, from the Buffer account you sign in with.',
        'Your Buffer access tokens, stored encrypted.',
        'Your post text and all of its versions.',
        'Your reactions to persona readings.',
        'We also keep usage events, which count how much voice and analysis you use so we can apply your plan limits.',
        'Your Stripe customer ID, if you subscribe to a paid plan. We never see or store your card number; Stripe does.',
      ],
    },
    {
      heading: 'Who processes your data',
      paragraphs: ['We use these services to run Vocelo:'],
      items: [
        'Buffer: sign-in, your channels, and saving drafts to your account.',
        'ElevenLabs: turns text into spoken audio.',
        'Anthropic: analyzes text to produce persona reactions.',
        'Stripe: payments and subscriptions.',
        'Netlify: hosting.',
        'Neon: our database.',
      ],
    },
    {
      heading: 'When your text leaves Vocelo',
      paragraphs: [
        'Your post text is sent to ElevenLabs or Anthropic only when you ask for a reading or an analysis. Typing or saving a post does not send it to either service.',
        'Generated audio is cached and shared by a hash of the text, so the same text read by the same voice is not generated twice. The hash identifies the text, not you.',
      ],
    },
    {
      heading: 'What we do not do',
      paragraphs: [
        'We do not sell your data. We do not use it for advertising. We only use essential cookies to keep you signed in.',
      ],
    },
    {
      heading: 'Deleting your data',
      paragraphs: [
        `Disconnecting Buffer in Settings removes your stored Buffer connection and tokens. To delete everything else we hold about you, email ${email} and we will delete it.`,
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about this policy: ${email}.`],
    },
  ],
}

const terms: LegalDoc = {
  title: 'Terms',
  heading: 'Terms of Service',
  lastUpdated: '2026-11-13',
  sections: [
    {
      heading: 'Where this service is at',
      paragraphs: [
        'Vocelo is a hackathon-stage service. It may change, break, or go away. Do not rely on it as the only copy of anything important; your posts also live in your Buffer account.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'Vocelo is provided as is and without warranty of any kind. To the extent the law allows, we are not liable for lost data, missed posts, or any other loss from using the service. Persona readings are automated opinions, not advice or a guarantee of how real readers will respond.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: ['Acceptable use means you agree not to:'],
      items: [
        'Break the law or Buffer’s terms with content you write or save.',
        'Attempt to access other people’s accounts or data.',
        'Overload, probe, or reverse engineer the service, or get around plan limits.',
        'Use the service to create content that harasses, deceives, or harms others.',
      ],
    },
    {
      heading: 'Billing',
      paragraphs: [
        'The Creator plan is billed monthly through Stripe. You can cancel any time. Cancelling stops future charges, and your Creator access ends at the end of your current billing period. Plan limits and prices are shown on the pricing page.',
      ],
    },
    {
      heading: 'Your content and account',
      paragraphs: [
        'Your posts stay yours. You give us permission to process them only to provide the service, as described in the Privacy Policy. You can disconnect Buffer at any time.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these terms: ${email}.`],
    },
  ],
}

export const legal = { privacy, terms } as const
