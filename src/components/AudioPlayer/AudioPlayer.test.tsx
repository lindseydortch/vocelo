// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAudioPlayer, useAudioPlayer } from '~/hooks/useAudioPlayer'
import { AudioPlayer } from './AudioPlayer'

class FakeAudio {
  static instances: FakeAudio[] = []
  listeners: Record<string, (() => void)[]> = {}
  currentTime = 0
  duration = 10
  paused = true
  constructor(public src: string) {
    FakeAudio.instances.push(this)
  }
  addEventListener(name: string, fn: () => void) {
    ;(this.listeners[name] ??= []).push(fn)
  }
  emit(name: string) {
    this.listeners[name]?.forEach((fn) => fn())
  }
  removeAttribute() {}
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
}

function audio(i: number): FakeAudio {
  const el = FakeAudio.instances[i]
  if (!el) throw new Error(`no audio instance ${i}`)
  return el
}

function at<T>(items: T[], i: number): T {
  const item = items[i]
  if (item === undefined) throw new Error(`no item ${i}`)
  return item
}

const synth = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}

beforeEach(() => {
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  )
  Object.defineProperty(window, 'speechSynthesis', {
    value: synth,
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  act(() => resetAudioPlayer())
  vi.unstubAllGlobals()
  Object.values(synth).forEach((f) => f.mockClear())
})

const a = { mode: 'audio', personaId: 'a', url: '/api/audio/a' } as const
const b = { mode: 'audio', personaId: 'b', url: '/api/audio/b' } as const

describe('AudioPlayer', () => {
  it('plays, pauses and stops an audio clip', () => {
    render(<AudioPlayer clip={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(audio(0).play).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(audio(0).pause).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('shows progress from timeupdate', () => {
    render(<AudioPlayer clip={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => {
      audio(0).currentTime = 5
      audio(0).emit('timeupdate')
    })
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0.5')
  })

  it('plays one clip at a time', () => {
    render(
      <>
        <AudioPlayer clip={a} />
        <AudioPlayer clip={b} />
      </>,
    )
    const plays = screen.getAllByRole('button', { name: 'Play' })
    fireEvent.click(at(plays, 0))
    fireEvent.click(at(plays, 1))
    expect(audio(0).pause).toHaveBeenCalled()
    expect(audio(1).play).toHaveBeenCalled()
    const groups = screen.getAllByRole('group')
    expect(at(groups, 0).getAttribute('data-playing')).toBe('false')
    expect(at(groups, 1).getAttribute('data-playing')).toBe('true')
  })

  it('stops audio on unmount', () => {
    const { unmount } = render(<AudioPlayer clip={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    unmount()
    expect(audio(0).pause).toHaveBeenCalled()
  })

  it('does not stop a clip started by another consumer on unmount', () => {
    render(<AudioPlayer clip={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    function Idle() {
      useAudioPlayer()
      return null
    }
    render(<Idle />).unmount()
    expect(audio(0).pause).not.toHaveBeenCalled()
  })

  it('speaks browser-mode clips and cancels on unmount', () => {
    const clip = {
      mode: 'browser',
      personaId: 'c',
      text: 'hello there',
    } as const
    const { unmount } = render(<AudioPlayer clip={clip} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(synth.speak).toHaveBeenCalledTimes(1)
    const utterance = at(synth.speak.mock.calls, 0)[0]
    act(() => utterance.onboundary({ charIndex: 5 }))
    expect(
      Number(screen.getByRole('progressbar').getAttribute('value')),
    ).toBeCloseTo(5 / 11)
    synth.cancel.mockClear()
    unmount()
    expect(synth.cancel).toHaveBeenCalled()
  })

  it('starting browser mode stops a playing audio clip', () => {
    render(
      <>
        <AudioPlayer clip={a} />
        <AudioPlayer clip={{ mode: 'browser', personaId: 'c', text: 'hi' }} />
      </>,
    )
    const plays = screen.getAllByRole('button', { name: 'Play' })
    fireEvent.click(at(plays, 0))
    fireEvent.click(at(plays, 1))
    expect(audio(0).pause).toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalled()
  })

  it('returns to idle when the clip errors', () => {
    render(<AudioPlayer clip={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => audio(0).emit('error'))
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('ignores late events from a stopped clip when the same clip is replayed', () => {
    const clip = { mode: 'browser', personaId: 'c', text: 'hello' } as const
    render(<AudioPlayer clip={clip} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    const first = at(synth.speak.mock.calls, 0)[0]
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => first.onerror())
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  })
})
