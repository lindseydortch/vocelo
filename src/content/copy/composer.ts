export const composerCopy = {
  title: 'Composer',
  slots: {
    banners: 'Banners will live here.',
    meter: 'Usage meter will live here.',
    channel: 'Channel picker will live here.',
    editor: 'Editor will live here.',
    counter: 'Character counter will live here.',
    save: 'Save button will live here.',
    hint: 'Hint will live here.',
    persona: 'Persona panel will live here.',
  },
  bufferCheckFailed: "Couldn't check Buffer just now.",
  missingInBuffer: 'This post is no longer in Buffer.',
  bufferStatus: {
    scheduled: (when: string) =>
      `Scheduled for ${when}. Edits here won't change it.`,
    scheduledNoTime: "Scheduled in Buffer. Edits here won't change it.",
    needsApproval: 'Waiting for approval in Buffer.',
    sending: 'Posting now.',
    sent: 'Posted.',
    errorFallback: "Buffer couldn't post this.",
  },
  readOnly: 'This sample post is read-only.',
  lockedRedirect: 'This post is locked on your plan',
} as const
