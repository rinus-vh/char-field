// Lifts the video pre-extraction state out of CharFieldViewport so that
// both the viewport and the export panel can consume the same frames/masks
// without re-running the (slow) extraction twice.
import { createContext, useContext } from 'react'

export const VideoPrerenderContext = createContext(null)

export function useVideoPrerenderContext() {
  return useContext(VideoPrerenderContext)
}
