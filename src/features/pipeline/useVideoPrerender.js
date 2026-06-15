import { useEffect, useState } from 'react'

import { resolveMask } from './renderPipeline.js'

// Sample rate for extracting frames from the video clip.
const TARGET_FPS = 15

/**
 * Single-phase video pre-extractor.
 *
 * Extracts frames at TARGET_FPS and resolves a mask for each. Both steps are
 * slow (async seeks + mask generation), so this runs once per source / mask
 * setting change and shows the loading overlay while it works. The first frame
 * (and mask) is emitted as soon as it's ready so the viewport can display
 * something before the rest finishes.
 *
 * Glyph rendering is intentionally NOT pre-computed here. The viewport paints
 * each frame to a canvas live (cheap fillText) so keyframed glyph settings stay
 * in sync without invalidating a cache. See CharFieldViewport.
 *
 * Returns:
 *   frames[]    — raw Frame objects
 *   masks[]     — per-frame masks
 *   fps         — frame rate used for extraction
 *   progress    — 0‒1 progress
 *   isRendering — true while still extracting (shows overlay)
 */
export function useVideoPrerender(source, committedMaskSettings) {
  const [state, setState] = useState(() => ({
    frames:      [],
    masks:       [],
    fps:         TARGET_FPS,
    progress:    0,
    isRendering: source?.kind === 'video',
  }))

  const { maskMode, maskTolerance } = committedMaskSettings

  // Reset to the empty state whenever an extraction input changes — the sanctioned
  // prop-change pattern, rather than a synchronous setState inside the effect. A
  // video source starts in the rendering state so the loading overlay shows until
  // the first frame lands; anything else settles immediately.
  const [prevInputs, setPrevInputs] = useState({ source, maskMode, maskTolerance })
  if (
    source        !== prevInputs.source ||
    maskMode      !== prevInputs.maskMode ||
    maskTolerance !== prevInputs.maskTolerance
  ) {
    setPrevInputs({ source, maskMode, maskTolerance })
    setState({
      frames: [], masks: [], fps: TARGET_FPS, progress: 0,
      isRendering: source?.kind === 'video',
    })
  }

  useEffect(() => {
    if (!source || source.kind !== 'video') return

    let cancelled = false
    const fps        = TARGET_FPS
    const duration   = source.duration
    const frameCount = Math.max(1, Math.round(duration * fps))

    ;(async () => {
      const frames = []
      const masks  = []

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) return
        const t = frameCount > 1
          ? Math.min((i / (frameCount - 1)) * duration, duration - 0.001)
          : 0
        const frame = await source.getFrame(t)
        frames.push(frame)

        const { mask } = await resolveMask(frame, { maskMode, maskTolerance })
        if (cancelled) return
        masks.push(mask)

        const total    = frameCount * 2
        const done     = i * 2 + 2 // two steps per frame (extract + mask)
        const progress = done / total

        // Emit after the first frame and every ~10 frames so the UI stays
        // responsive without thrashing React.
        if (i === 0 || (i + 1) % 10 === 0 || i === frameCount - 1) {
          setState({
            frames:      [...frames],
            masks:       [...masks],
            fps,
            progress,
            isRendering: i < frameCount - 1,
          })
        }
      }

      if (cancelled) return
      setState({ frames, masks, fps, progress: 1, isRendering: false })
    })()

    return () => { cancelled = true }
  }, [source, maskMode, maskTolerance])

  return state
}
