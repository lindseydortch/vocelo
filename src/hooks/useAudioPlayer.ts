import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

export type Clip =
  | { mode: 'audio'; personaId: string; url: string }
  | { mode: 'browser'; personaId: string; text: string }

export type PlayerState = {
  status: 'idle' | 'playing' | 'paused'
  personaId: string | null
  /** 0 to 1 */
  progress: number
}

const IDLE: PlayerState = { status: 'idle', personaId: null, progress: 0 }

// One shared controller for the whole app: starting a clip stops the current one.
let state: PlayerState = IDLE
let current: { clip: Clip; stop: () => void; pause: () => void; resume: () => void } | null = null
const listeners = new Set<() => void>()

function setState(next: PlayerState) {
  state = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function stop() {
  const active = current
  current = null
  active?.stop()
  setState(IDLE)
}

function startAudio(clip: Extract<Clip, { mode: 'audio' }>) {
  const el = new Audio(clip.url)
  const isCurrent = () => current?.clip === clip
  el.addEventListener('timeupdate', () => {
    if (isCurrent() && el.duration > 0) {
      setState({ ...state, progress: Math.min(el.currentTime / el.duration, 1) })
    }
  })
  el.addEventListener('ended', () => {
    if (isCurrent()) stop()
  })
  el.addEventListener('error', () => {
    if (isCurrent()) stop()
  })
  current = {
    clip,
    stop: () => {
      el.pause()
      el.removeAttribute('src')
    },
    pause: () => el.pause(),
    resume: () => void el.play().catch(() => isCurrent() && stop()),
  }
  void el.play().catch(() => isCurrent() && stop())
}

function startBrowser(clip: Extract<Clip, { mode: 'browser' }>) {
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(clip.text)
  const isCurrent = () => current?.clip === clip
  utterance.onboundary = (e) => {
    if (isCurrent() && clip.text.length > 0) {
      setState({ ...state, progress: Math.min(e.charIndex / clip.text.length, 1) })
    }
  }
  utterance.onend = () => {
    if (isCurrent()) stop()
  }
  utterance.onerror = () => {
    if (isCurrent()) stop()
  }
  current = {
    clip,
    stop: () => synth.cancel(),
    pause: () => synth.pause(),
    resume: () => synth.resume(),
  }
  synth.speak(utterance)
}

function play(clip: Clip) {
  stop()
  current = null
  setState({ status: 'playing', personaId: clip.personaId, progress: 0 })
  if (clip.mode === 'audio') startAudio(clip)
  else startBrowser(clip)
}

function pause() {
  if (state.status !== 'playing' || !current) return
  current.pause()
  setState({ ...state, status: 'paused' })
}

function resume() {
  if (state.status !== 'paused' || !current) return
  current.resume()
  setState({ ...state, status: 'playing' })
}

/** Test helper: reset the shared controller between tests. */
export function resetAudioPlayer() {
  stop()
}

export function useAudioPlayer() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => IDLE)
  const owned = useRef<Clip | null>(null)

  const start = useCallback((clip: Clip) => {
    play(clip)
    owned.current = clip
  }, [])

  // Unmount or route change stops a clip this consumer started.
  useEffect(
    () => () => {
      if (owned.current && current?.clip === owned.current) stop()
    },
    [],
  )

  return {
    ...snapshot,
    isPlaying: snapshot.status === 'playing',
    play: start,
    pause,
    resume,
    stop,
  }
}
