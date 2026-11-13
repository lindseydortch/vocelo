import { channelPhrase, DATA_RULE, wrap, type Prompt } from './shared'
import { STANDARD_PERSONA_PROMPTS } from './standard-personas'

export type ReactionPersona = {
  id: string
  name: string
  /** null for standard personas */
  userId: string | null
  readerDescription: string
}

const OUTPUT_RULES =
  'Reply with one short reaction of at most 280 characters, in plain text, as this reader would say it. No preamble.'

export function buildReactionPrompt({
  persona,
  text,
  channelService,
}: {
  persona: ReactionPersona
  text: string
  channelService: string
}): Prompt {
  const channel = channelPhrase(channelService)
  const standard =
    persona.userId === null ? STANDARD_PERSONA_PROMPTS[persona.id] : undefined

  if (standard) {
    return {
      system: `${standard}\nThe text you will read is ${channel}.\n${OUTPUT_RULES}\n${DATA_RULE}`,
      user: `Here is ${channel}:\n${wrap('post', text)}`,
    }
  }

  return {
    system: `You react to social posts as the reader described inside <reader>. Stay in that character. The text you will read is ${channel}.\n${OUTPUT_RULES}\n${DATA_RULE}`,
    user: `Who you are:\n${wrap('reader', persona.readerDescription)}\n\nHere is ${channel}:\n${wrap('post', text)}`,
  }
}
