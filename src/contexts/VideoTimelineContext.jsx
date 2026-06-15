// Timeline context for video sources. Duration is fixed by the uploaded clip
// rather than expanding with keyframes (unlike mesh-stage). The rAF loop
// drives playback; React state updates are throttled to ~fps so the viewport
// seeks at a sensible rate rather than every animation frame.
import { createContext, useContext } from 'react'

export const selKey = (trackId, keyframeId) => `${trackId}::${keyframeId}`

// The char-field settings that can be animated on the timeline.
export const ANIMATABLE_TRACKS = [
  { path: 'cellSize',         label: 'Scale' },
  { path: 'contrast',         label: 'Contrast' },
  { path: 'invert',           label: 'Invert' },
  { path: 'glyphSet',         label: 'Character set' },
  { path: 'backgroundColor',  label: 'Background' },
]

export const VideoTimelineContext = createContext(null)

export function useVideoTimelineContext() {
  return useContext(VideoTimelineContext)
}
