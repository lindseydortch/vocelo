import { useAudioPlayer, type Clip } from '~/hooks/useAudioPlayer'

/** The speaking indicator (V11) reads `isPlaying` + `personaId` from `useAudioPlayer()`. */
export function AudioPlayer({ clip }: { clip: Clip }) {
  const player = useAudioPlayer()
  const active = player.personaId === clip.personaId && player.status !== 'idle'

  function toggle() {
    if (!active) player.play(clip)
    else if (player.status === 'playing') player.pause()
    else player.resume()
  }

  return (
    <div
      role="group"
      aria-label="Audio player"
      data-persona-id={clip.personaId}
      data-playing={active && player.isPlaying}
    >
      <button type="button" onClick={toggle}>
        {active && player.isPlaying ? 'Pause' : 'Play'}
      </button>
      <button type="button" onClick={player.stop} disabled={!active}>
        Stop
      </button>
      <progress
        max={1}
        value={active ? player.progress : 0}
        aria-label="Playback progress"
      />
    </div>
  )
}
