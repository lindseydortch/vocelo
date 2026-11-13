export const authCopy = {
  signin: {
    title: 'Sign in',
    heading: 'Sign in',
    cta: 'Sign in with Buffer',
    expired: 'Your Buffer connection expired. Sign in again to keep going.',
  },
  error: {
    title: 'Sign-in problem',
    heading: "Couldn't sign you in",
    retry: 'Try again',
    reasons: {
      cancelled:
        'You cancelled the Buffer sign-in. Try again when you are ready.',
      timeout: 'The sign-in took too long or expired. Try again.',
      exchange: "We couldn't finish signing you in with Buffer. Try again.",
      account: "We couldn't load your Buffer account. Try again.",
      scopes:
        'Vocelo needs permission to read and write your Buffer posts and to stay connected. Try again and allow all requested access.',
    },
  },
  app: {
    title: 'Vocelo',
    heading: 'Vocelo',
    placeholder: 'Your dashboard will live here.',
  },
  settings: {
    title: 'Settings',
    heading: 'Settings',
    placeholder: 'Your settings will live here.',
    signOut: 'Sign out',
  },
} as const
