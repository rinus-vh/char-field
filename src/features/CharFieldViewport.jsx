import { useEffect, useMemo, useState } from 'react'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { resolveMask, computeCharField } from '@/features/pipeline/renderPipeline.js'
import { CELL_ASPECT } from '@/features/pipeline/glyphGrid.js'

import styles from './CharFieldViewport.module.css'

// Renders the live glyph output as vector SVG text — crisp at any zoom, unlike a
// scaled raster canvas. Work splits into a mask step (cached, possibly slow) and a
// grid step (cheap), so adjusting visual settings never re-runs segmentation. State
// survives panel minimize because the source lives in context.
export function CharFieldViewport() {
  const { source, settings, effectiveTextColor } = useCharField()

  const [frame, setFrame] = useState(null)
  const [mask, setMask] = useState(null)
  const [status, setStatus] = useState('idle')

  const { maskMode, maskTolerance } = settings

  // Pull a frame from the active source.
  useEffect(() => {
    let active = true
    source.getFrame().then(f => { if (active) setFrame(f) })
    return () => { active = false }
  }, [source])

  // Mask step — re-runs only when the frame or mask settings change.
  useEffect(() => {
    if (!frame) return
    let active = true
    const timer = setTimeout(() => {
      setStatus('masking')
      resolveMask(frame, { maskMode, maskTolerance })
        .then(({ mask: m }) => { if (active) { setMask(m); setStatus('ready') } })
        .catch(() => { if (active) setStatus('error') })
    }, 80)
    return () => { active = false; clearTimeout(timer) }
  }, [frame, maskMode, maskTolerance])

  // Grid — derived on any visual change. Cheap pixel sampling, no painting.
  const grid = useMemo(() => {
    if (!frame || !mask) return null
    return computeCharField(frame, mask, {
      aspectRatio: settings.aspectRatio,
      rotation: settings.rotation,
      cellSize: settings.cellSize,
      contrast: settings.contrast,
      invert: settings.invert,
      glyphSet: settings.glyphSet,
    })
  }, [
    frame, mask,
    settings.aspectRatio, settings.rotation,
    settings.cellSize, settings.contrast, settings.invert, settings.glyphSet,
  ])

  return (
    <div className={styles.component}>
      {grid && grid.cols > 0 && (
        <svg
          viewBox={`0 0 ${grid.cols * CELL_ASPECT} ${grid.rows}`}
          preserveAspectRatio='xMidYMid meet'
          style={{ background: settings.backgroundColor }}
          className={styles.output}
        >
          {grid.lines.map((line, row) =>
            line.trim() === '' ? null : (
              <text
                key={row}
                x={0}
                y={row + 0.78}
                fontSize={1}
                textLength={grid.cols * CELL_ASPECT}
                lengthAdjust='spacingAndGlyphs'
                fontFamily='var(--font-family-alt), monospace'
                fill={effectiveTextColor}
                xmlSpace='preserve'
              >
                {line}
              </text>
            ),
          )}
        </svg>
      )}
      {status === 'masking' && <span className={styles.badge}>Isolating subject…</span>}
    </div>
  )
}
