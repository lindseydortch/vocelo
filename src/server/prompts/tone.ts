import { TONE_LABELS } from '~/lib/tone'
import { channelPhrase, DATA_RULE, wrap } from './shared'

export function buildTonePrompt({
  text,
  channelService,
}: {
  text: string
  channelService: string
}): { system: string; user: string } {
  const channel = channelPhrase(channelService)
  return {
    system: `You read the overall tone of ${channel}. Choose exactly one label from this list: ${TONE_LABELS.join(', ')}. Then give a one-sentence summary of why.\n${DATA_RULE}`,
    user: `Here is ${channel}:\n${wrap('post', text)}`,
  }
}
