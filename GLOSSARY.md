# Vocelo

Vocelo lets a writer hear their social post read aloud by different readers before it goes out through Buffer, so they learn how it lands.

## Writing

**Post**:
One piece of writing in Vocelo, for exactly one channel. It may or may not have a Buffer draft yet.
_Avoid_: Draft (when you mean the Vocelo side), note, content

**Buffer draft**:
The copy of a Post that lives in the user's Buffer account. Vocelo's text wins when they differ.
_Avoid_: Post (when you mean the Buffer side), Buffer post

**Save draft**:
Sending a Post's current text to its Buffer draft (creating the draft the first time). The only action that writes to Buffer and the only one that creates a Version. Text kept in Vocelo but not yet sent is "not in Buffer yet".
_Avoid_: Save (on its own), sync, publish, unsaved (when you mean "not in Buffer yet")

**Schedule**:
Handing a saved Post to Buffer to publish, either in the Channel's queue or at a picked time. Scheduling saves the text to the Buffer draft first.
_Avoid_: Approve, approve & schedule, publish, post now

**Move back to draft**:
Taking a scheduled Buffer draft out of Buffer's queue so it is a draft again and won't publish.
_Avoid_: Unschedule, cancel

**Channel**:
One connected social account in Buffer (e.g. a LinkedIn page, an X profile) that a Post is written for.
_Avoid_: Profile, network, platform

**Sample post**:
A read-only Post every new user starts with, so they can hear Personas before writing anything. It never counts toward limits and never locks; deleting it is permanent.
_Avoid_: Demo post, example, seed post

**Version**:
A saved snapshot of a Post's text, created each time the Post is successfully saved to Buffer.
_Avoid_: Revision, history entry, autosave

## Listening

**Persona**:
A simulated reader with a name, bio, voice, and point of view. Either **standard** (provided by Vocelo) or **custom** (created by a paying user).
_Avoid_: Character, voice, custom voice avatar

**Voice avatar**:
The image or card that represents a Persona on screen. Only the visual, never the Persona itself.
_Avoid_: Avatar (on its own), persona card

**Reaction**:
A Persona's one-to-two-sentence response to a Post's text, as read on that Post's Channel. A Reaction goes **stale** when the text or the Persona changes after it was made; stale Reactions stay visible until refreshed.
_Avoid_: Feedback, comment, review

**Tone read**:
A single, persona-independent judgment of how a whole Post comes across on its Channel: one **tone label** from a fixed set plus a one-sentence summary.
_Avoid_: Tone heat map (that is the per-sentence stretch feature), sentiment

## Plans and limits

**Usage period**:
The window in which all of a user's usage limits are counted; every limit resets together when a new one starts.
_Avoid_: Month, billing cycle (unless the user is paying)

**Reviewed post**:
A Post that has triggered something that costs Vocelo money (new voice audio, a Reaction, or a Tone read) at least once in the current Usage period. Each Post counts at most once per period.
_Avoid_: Read, review (as a verb-noun for a single playback)

**Voice characters**:
The number of text characters turned into new audio. Replaying audio Vocelo already made uses none.
_Avoid_: Credits, words, reads

**History window**:
How far back, measured from a Post's last edit, a user's plan lets them see their Posts and everything attached to them.
_Avoid_: Retention, archive

**Locked**:
Kept but hidden by the user's plan, and visible again instantly on upgrade. Locked things are never deleted in the MVP.
_Avoid_: Deleted, archived, expired
