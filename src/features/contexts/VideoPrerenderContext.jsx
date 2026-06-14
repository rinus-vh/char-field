// Lifts the video pre-extraction state out of CharFieldViewport so that
// both the viewport and the export panel can consume the same frames/masks
// without re-running the (slow) extraction twice.

import { createContext, useContext, useMemo } from 'react'

import { useCharField } from './CharFieldContext.jsx'
import { useVideoTimeline } from './VideoTimelineContext.jsx'
import { useVideoPrerender } from '../pipeline/useVideoPrerender.js'

const VideoPrerenderContext = createContext(null)

export function VideoPrerenderProvider({ children }) {
  const { source, committedSettings } = useCharField()
  const { isVideo } = useVideoTimeline()

  const committedMaskSettings = useMemo(() => ({
    maskMode:      committedSettings.maskMode,
    maskTolerance: committedSettings.maskTolerance,
  }), [committedSettings.maskMode, committedSettings.maskTolerance])

  const prerender = useVideoPrerender(isVideo ? source : null, committedMaskSettings)

  return (
    <VideoPrerenderContext.Provider value={prerender}>
      {children}
    </VideoPrerenderContext.Provider>
  )
}

export function useVideoPrerenderContext() {
  return useContext(VideoPrerenderContext)
}
