import { useMemo } from 'react'

import { useVideoPrerender } from '@/features/pipeline/useVideoPrerender.js'

import { useCharFieldContext } from './CharFieldContext.jsx'
import { useVideoTimelineContext } from './VideoTimelineContext.jsx'
import { VideoPrerenderContext } from './VideoPrerenderContext.jsx'

export function VideoPrerenderContextProvider({ children }) {
  const { source, committedSettings } = useCharFieldContext()
  const { isVideo } = useVideoTimelineContext()

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
