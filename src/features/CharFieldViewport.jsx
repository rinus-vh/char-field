import { useEffect, useMemo, useRef, useState } from 'react'
import { useGesture } from '@use-gesture/react'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { resolveMask, computeCharField } from '@/features/pipeline/renderPipeline.js'
import { CELL_ASPECT } from '@/features/pipeline/glyphGrid.js'

import styles from './CharFieldViewport.module.css'

const MIN_SCALE = 0.25
const MAX_SCALE = 20

// Renders the live glyph output as vector SVG text — crisp at any zoom level.
// Work splits into a mask step (cached, possibly slow) and a grid step (cheap),
// so adjusting visual settings never re-runs segmentation.
export function CharFieldViewport() {
  const { source, settings, effectiveTextColor } = useCharField()

  const [frame, setFrame] = useState(null)
  const [mask, setMask] = useState(null)
  const [status, setStatus] = useState('idle')
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [buttonFaded, setButtonFaded] = useState(false)
  const fadeTimerRef = useRef(null)

  const containerRef = useRef(null)
  const { maskMode, maskTolerance, imageFit } = settings

  // Pull a frame from the active source (static).
  useEffect(() => {
    if (!source || source.isAnimated) return
    let active = true
    source.getFrame().then(f => { if (active) setFrame(f) })
    return () => { active = false }
  }, [source])

  // Poll for frames when source is a live feed. ~8 fps is enough to feel live
  // while keeping the mask debounce (80 ms) from thrashing.
  useEffect(() => {
    if (!source?.isAnimated) return
    let active = true
    let timer
    async function poll() {
      if (!active) return
      const f = await source.getFrame()
      if (active) setFrame(f)
      if (active) timer = setTimeout(poll, 125)
    }
    poll()
    return () => { active = false; clearTimeout(timer) }
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
      imageFit: settings.imageFit,
      rotation: settings.rotation,
      cellSize: settings.cellSize,
      contrast: settings.contrast,
      invert: settings.invert,
      glyphSet: settings.glyphSet,
    })
  }, [
    frame, mask,
    settings.aspectRatio, settings.imageFit, settings.rotation,
    settings.cellSize, settings.contrast, settings.invert, settings.glyphSet,
  ])

  // Reset transform when image fit changes so the new composition displays correctly.
  useEffect(() => { setTransform({ x: 0, y: 0, scale: 1 }) }, [imageFit])

  // Show the reset button briefly after any zoom/pan interaction, then fade it out.
  function scheduleButtonFade() {
    setButtonFaded(false)
    clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => setButtonFaded(true), 1500)
  }

  function resetTransform() { setTransform({ x: 0, y: 0, scale: 1 }); setButtonFaded(false); clearTimeout(fadeTimerRef.current) }

  useEffect(() => () => clearTimeout(fadeTimerRef.current), [])

  // With target set, useGesture attaches listeners directly to the ref — no bind() spread needed.
  useGesture(
    {
      onDrag: ({ offset: [x, y], dragging: d }) => {
        // Only pan when zoomed — at scale 1 leave text selectable.
        if (transform.scale <= 1) return
        setDragging(d)
        setTransform(t => ({ ...t, x, y }))
        scheduleButtonFade()
      },
      onPinch: ({ offset: [scale] }) => {
        setTransform(t => ({ ...t, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) }))
        scheduleButtonFade()
      },
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault()
        setTransform(t => ({
          ...t,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * (1 - dy * 0.002))),
        }))
        scheduleButtonFade()
      },
    },
    {
      target: containerRef,
      drag: { from: () => [transform.x, transform.y] },
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, from: () => [transform.scale, 0] },
      wheel: { eventOptions: { passive: false } },
    },
  )

  const isZoomed = transform.scale !== 1

  return (
    <div
      ref={containerRef}
      onDoubleClick={resetTransform}
      className={styles.component}
      style={{
        cursor: dragging ? 'grabbing' : isZoomed ? 'grab' : 'default',
        userSelect: isZoomed ? 'none' : 'auto',
      }}
    >
      <div
        className={styles.transformLayer}
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
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
      </div>

      {status === 'masking' && <span className={styles.badge}>Isolating subject…</span>}

      {transform.scale !== 1 && (
        <button
          type='button'
          className={`${styles.resetZoomButton}${buttonFaded ? ` ${styles.resetZoomButtonFaded}` : ''}`}
          onClick={resetTransform}
        >
          Reset zoom
        </button>
      )}
    </div>
  )
}
