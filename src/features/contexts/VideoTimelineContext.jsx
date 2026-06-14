// Timeline context for video sources. Duration is fixed by the uploaded clip
// rather than expanding with keyframes (unlike mesh-stage). The rAF loop
// drives playback; React state updates are throttled to ~fps so the viewport
// seeks at a sensible rate rather than every animation frame.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useCharField } from './CharFieldContext.jsx'
import { sampleTrack } from '../pipeline/interpolate.js'

const EPSILON = 0.04

let _id = 0
const nextId = () => `kf_${_id++}`
export const selKey = (trackId, keyframeId) => `${trackId}::${keyframeId}`

// The char-field settings that can be animated on the timeline.
export const ANIMATABLE_TRACKS = [
  { path: 'cellSize',         label: 'Scale' },
  { path: 'contrast',         label: 'Contrast' },
  { path: 'invert',           label: 'Invert' },
  { path: 'backgroundColor',  label: 'Background' },
]

function sampleAll(tracks, time) {
  const out = {}
  for (const track of tracks) {
    if (!track.muted) {
      const v = sampleTrack(track.keyframes, time)
      if (v !== undefined) out[track.path] = v
    }
  }
  return out
}

const VideoTimelineContext = createContext(null)

export function VideoTimelineProvider({ children }) {
  const { source } = useCharField()
  const isVideo    = source?.kind === 'video'
  const duration   = isVideo ? (source.duration ?? 0) : 0

  const [tracks,            setTracks]            = useState([])
  const [playhead,          setPlayheadState]      = useState(0)
  const [playing,           setPlaying]            = useState(false)
  const [loop,              setLoop]               = useState(true)
  const [fps,               setFps]                = useState(24)
  const [recording,         setRecording]          = useState(false)
  const [selectedKeyframes, setSelectedKeyframes]  = useState(() => new Set())
  const [anchorKeyframe,    setAnchorKeyframe]      = useState(null)
  const [liveSample,        setLiveSample]          = useState({})

  // Mutable refs — always current, safe inside rAF/callbacks.
  const playheadRef          = useRef(0)
  const playingRef           = useRef(false)
  const loopRef              = useRef(true)
  const durationRef          = useRef(duration)
  const tracksRef            = useRef(tracks)
  const recordingRef         = useRef(recording)
  const selectedKeyframesRef = useRef(selectedKeyframes)
  const anchorKeyframeRef    = useRef(anchorKeyframe)
  const sampleRef            = useRef({})
  const fpsRef               = useRef(fps)

  durationRef.current          = duration
  tracksRef.current            = tracks
  playingRef.current           = playing
  loopRef.current              = loop
  recordingRef.current         = recording
  selectedKeyframesRef.current = selectedKeyframes
  anchorKeyframeRef.current    = anchorKeyframe
  fpsRef.current               = fps

  // Reset everything when a new video source is loaded (or source is cleared).
  useEffect(() => {
    playingRef.current = false
    setPlaying(false)
    playheadRef.current = 0
    setPlayheadState(0)
    setTracks([])
    tracksRef.current = []
    sampleRef.current = {}
    setLiveSample({})
    selectedKeyframesRef.current = new Set()
    setSelectedKeyframes(new Set())
    setAnchorKeyframe(null)
  }, [source])

  // rAF playback loop — advances playhead, throttles React state to fps.
  useEffect(() => {
    let raf
    let prev         = null
    let lastUpdate   = 0
    const stateInterval = 1000 / 30 // state updates at most 30×/s regardless of fps setting

    const tick = (now) => {
      if (prev == null) prev = now
      const dt = Math.min((now - prev) / 1000, 0.1) // cap dt to avoid big jumps
      prev = now

      if (playingRef.current) {
        const dur = durationRef.current
        let p = playheadRef.current + dt
        if (p >= dur) {
          p = loopRef.current ? (dur > 0 ? p % dur : 0) : dur
          if (!loopRef.current) { playingRef.current = false; setPlaying(false) }
        }
        playheadRef.current = p

        if (now - lastUpdate >= stateInterval) {
          lastUpdate = now
          setPlayheadState(p)
          const s = sampleAll(tracksRef.current, p)
          sampleRef.current = s
          setLiveSample(s)
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Samples all animated tracks at an arbitrary time. Used by the viewport's
  // playback render loop, which reads the precise playhead (not the throttled
  // state) so keyframed settings stay in sync with the displayed frame.
  const sampleAt = useCallback((t) => sampleAll(tracksRef.current, t), [])

  const setPlayhead = useCallback((t) => {
    const clamped = Math.max(0, Math.min(durationRef.current, t))
    playheadRef.current = clamped
    setPlayheadState(clamped)
    const s = sampleAll(tracksRef.current, clamped)
    sampleRef.current = s
    setLiveSample(s)
  }, [])

  // ── Keyframe management ────────────────────────────────────────────────────

  const addOrUpdateKeyframe = useCallback((path, label, time, value) => {
    const t    = Math.max(0, Math.min(durationRef.current, time))
    const prev = tracksRef.current
    const idx  = prev.findIndex(tr => tr.path === path)
    let next
    if (idx === -1) {
      next = [...prev, { id: `track_${path}`, path, label, muted: false, keyframes: [{ id: nextId(), time: t, value }] }]
    } else {
      const track   = prev[idx]
      const existing = track.keyframes.findIndex(k => Math.abs(k.time - t) < EPSILON)
      const keyframes = existing !== -1
        ? track.keyframes.map((k, i) => (i === existing ? { ...k, value } : k))
        : [...track.keyframes, { id: nextId(), time: t, value }].sort((a, b) => a.time - b.time)
      next = [...prev]
      next[idx] = { ...track, keyframes }
    }
    tracksRef.current = next
    setTracks(next)
  }, [])

  const record = useCallback((path, label, value) => {
    if (recordingRef.current) {
      addOrUpdateKeyframe(path, label, playheadRef.current, value)
      sampleRef.current = { ...sampleRef.current, [path]: value }
      setLiveSample(s => ({ ...s, [path]: value }))
      return true
    }
    // Recording off — mute the track for this path so it stops overriding.
    setTracks(prev => {
      const track = prev.find(tr => tr.path === path && !tr.muted)
      if (track) return prev.map(tr => tr.id === track.id ? { ...tr, muted: true } : tr)
      return prev
    })
    return false
  }, [addOrUpdateKeyframe])

  const setTrackMuted = useCallback((trackId, muted) => {
    setTracks(prev => prev.map(tr => tr.id === trackId ? { ...tr, muted } : tr))
  }, [])

  const moveSelectedKeyframes = useCallback((anchorTrackId, anchorKeyframeId, newTime) => {
    const sel = selectedKeyframesRef.current
    const anchorKey = selKey(anchorTrackId, anchorKeyframeId)
    const useSelection = sel.has(anchorKey)

    setTracks(prev => {
      const anchorTrack = prev.find(tr => tr.id === anchorTrackId)
      const anchorKf    = anchorTrack?.keyframes.find(k => k.id === anchorKeyframeId)
      if (!anchorKf) return prev
      const delta = newTime - anchorKf.time
      if (Math.abs(delta) < 0.0001) return prev

      return prev.map(track => ({
        ...track,
        keyframes: track.keyframes
          .map(kf => {
            const move = useSelection
              ? sel.has(selKey(track.id, kf.id))
              : (track.id === anchorTrackId && kf.id === anchorKeyframeId)
            return move ? { ...kf, time: Math.max(0, Math.min(durationRef.current, kf.time + delta)) } : kf
          })
          .sort((a, b) => a.time - b.time),
      }))
    })
  }, [])

  const selectKeyframe = useCallback(({ trackId, keyframeId, multi = false, range = false }) => {
    const key = selKey(trackId, keyframeId)
    if (range) {
      const anchor = anchorKeyframeRef.current
      if (anchor && anchor.trackId === trackId) {
        const track   = tracksRef.current.find(tr => tr.id === trackId)
        const anchorKf = track?.keyframes.find(k => k.id === anchor.keyframeId)
        const thisKf   = track?.keyframes.find(k => k.id === keyframeId)
        if (anchorKf && thisKf) {
          const minT = Math.min(anchorKf.time, thisKf.time)
          const maxT = Math.max(anchorKf.time, thisKf.time)
          const newSel = new Set(selectedKeyframesRef.current)
          track.keyframes.forEach(k => { if (k.time >= minT && k.time <= maxT) newSel.add(selKey(trackId, k.id)) })
          selectedKeyframesRef.current = newSel
          setSelectedKeyframes(newSel)
          return
        }
      }
    }
    if (multi) {
      const newSel = new Set(selectedKeyframesRef.current)
      newSel.has(key) ? newSel.delete(key) : newSel.add(key)
      selectedKeyframesRef.current = newSel
      setSelectedKeyframes(newSel)
      setAnchorKeyframe({ trackId, keyframeId })
      return
    }
    const newSel = new Set([key])
    selectedKeyframesRef.current = newSel
    setSelectedKeyframes(newSel)
    setAnchorKeyframe({ trackId, keyframeId })
  }, [])

  const selectKeyframesInBox = useCallback((items) => {
    const newSel = new Set(items.map(({ trackId, keyframeId }) => selKey(trackId, keyframeId)))
    selectedKeyframesRef.current = newSel
    setSelectedKeyframes(newSel)
  }, [])

  const clearSelection = useCallback(() => {
    const empty = new Set()
    selectedKeyframesRef.current = empty
    setSelectedKeyframes(empty)
    setAnchorKeyframe(null)
  }, [])

  const clearAllTracks = useCallback(() => {
    const empty = new Set()
    tracksRef.current = []
    setTracks([])
    selectedKeyframesRef.current = empty
    setSelectedKeyframes(empty)
    setAnchorKeyframe(null)
    playheadRef.current = 0
    setPlayheadState(0)
    sampleRef.current = {}
    setLiveSample({})
  }, [])

  const play   = useCallback(() => { playingRef.current = true;  setPlaying(true)  }, [])
  const pause  = useCallback(() => { playingRef.current = false; setPlaying(false) }, [])
  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [play, pause])

  const value = useMemo(() => ({
    tracks, playhead, playheadRef, playing, loop, fps, duration, recording, selectedKeyframes, liveSample, sampleRef,
    record, addOrUpdateKeyframe, clearAllTracks, moveSelectedKeyframes,
    selectKeyframe, selectKeyframesInBox, clearSelection,
    setPlayhead, sampleAt, play, pause, toggle,
    setLoop, setRecording, setTrackMuted, setFps,
    isVideo,
  }), [
    tracks, playhead, playing, loop, fps, duration, recording, selectedKeyframes, liveSample,
    record, addOrUpdateKeyframe, clearAllTracks, moveSelectedKeyframes,
    selectKeyframe, selectKeyframesInBox, clearSelection,
    setPlayhead, sampleAt, play, pause, toggle,
    setLoop, setRecording, setTrackMuted, setFps,
    isVideo,
  ])

  return <VideoTimelineContext.Provider value={value}>{children}</VideoTimelineContext.Provider>
}

export function useVideoTimeline() {
  return useContext(VideoTimelineContext)
}
