import { useEffect, useMemo, useRef, useState } from 'react'
import { useGesture } from '@use-gesture/react'
import { Loader } from '@6njp/prototype-library'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { useVideoTimeline } from '@/features/contexts/VideoTimelineContext.jsx'
import { useVideoPrerenderContext } from '@/features/contexts/VideoPrerenderContext.jsx'
import { resolveMask, computeCharField } from '@/features/pipeline/renderPipeline.js'
import { getOutputDimensions, fillBackground, buildSubjectStage } from '@/features/pipeline/OutputCompositor.js'
import { renderGlyphs } from '@/features/pipeline/GlyphRenderer.js'
import { CELL_ASPECT } from '@/features/pipeline/glyphGrid.js'

import styles from './CharFieldViewport.module.css'

const MIN_SCALE = 0.25
const MAX_SCALE = 20

// Paints a single video frame to the output canvas. Either the glyph render
// (fast fillText, no SVG layout) or, when showing raw input, the source frame
// fitted into the output rectangle. Resizes the canvas backing store only when
// the output dimensions actually change — resizing clears + reallocates and is
// the single most expensive thing we can do per frame.
function paintVideoFrame(canvas, frame, mask, s, fontFamily, textColor, showRaw) {
  if (!canvas || !frame) return
  const { width: outW, height: outH } = getOutputDimensions(s.aspectRatio, frame.width, frame.height)

  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width  = outW
    canvas.height = outH
    canvas.style.aspectRatio = `${outW} / ${outH}`
  }

  const ctx = canvas.getContext('2d')
  fillBackground(ctx, s.backgroundColor)

  if (showRaw) {
    const fit = s.imageFit === 'cover'
      ? Math.max(outW / frame.width, outH / frame.height)
      : Math.min(outW / frame.width, outH / frame.height)
    const sw = frame.width * fit
    const sh = frame.height * fit
    ctx.drawImage(frame.canvas, (outW - sw) / 2, (outH - sh) / 2, sw, sh)
    return
  }

  if (!mask) return
  const stage = buildSubjectStage(frame, mask, outW, outH, s.rotation, s.imageFit)
  renderGlyphs(ctx, stage, {
    cellSize: s.cellSize,
    contrast: s.contrast,
    invert:   s.invert,
    glyphSet: s.glyphSet,
    textColor,
    fontFamily,
  })
}

export function CharFieldViewport() {
  const { source, settings, effectiveTextColor } = useCharField()
  const videoTimeline = useVideoTimeline()

  // ── Non-video frame state ──────────────────────────────────────────────────
  const [frame,  setFrame]  = useState(null)
  const [mask,   setMask]   = useState(null)
  const [status, setStatus] = useState('idle')

  // ── Transform / UI state ───────────────────────────────────────────────────
  const [transform,   setTransform]   = useState({ x: 0, y: 0, scale: 1 })
  const [dragging,    setDragging]    = useState(false)
  const [buttonFaded, setButtonFaded] = useState(false)
  const [holdActive,  setHoldActive]  = useState(false)

  const containerRef    = useRef(null)
  const rawCanvasRef    = useRef(null)
  const videoCanvasRef  = useRef(null)
  const fadeTimerRef    = useRef(null)
  const holdTimerRef    = useRef(null)
  const holdOriginRef   = useRef(null)

  const { maskMode, maskTolerance, imageFit } = settings
  const isVideo = source?.kind === 'video'

  // Font family for canvas glyph rendering — resolved once from the CSS var.
  const fontFamily = useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue('--font-family-alt').trim() || 'monospace',
    [],
  )

  // ── Video pre-extract (shared via context — also consumed by ExportPanel) ───
  const {
    frames:      preFrames,
    masks:       preMasks,
    fps:         preFps,
    progress:    preProgress,
    isRendering: preRendering,
  } = useVideoPrerenderContext()

  // Index into pre-extract arrays, driven by the timeline playhead.
  const videoPlayhead   = videoTimeline?.playhead
  const videoFrameIndex = useMemo(() => {
    if (!isVideo || !preFrames.length) return 0
    return Math.max(0, Math.min(
      Math.round((videoPlayhead ?? 0) * preFps),
      preFrames.length - 1,
    ))
  }, [isVideo, preFrames.length, videoPlayhead, preFps])

  // ── Effective (keyframed) settings for the current moment ───────────────────
  const liveSample = videoTimeline?.liveSample
  const effectiveSettings = useMemo(() => {
    if (!liveSample || Object.keys(liveSample).length === 0) return settings
    return { ...settings, ...liveSample }
  }, [settings, liveSample])

  const showingRaw = settings.showRawInput || holdActive
  const playing    = videoTimeline?.playing ?? false

  // ── Refs kept current for the imperative video rAF loop ─────────────────────
  const tlRef         = useRef(videoTimeline)
  const framesRef     = useRef(preFrames)
  const masksRef      = useRef(preMasks)
  const preFpsRef     = useRef(preFps)
  const settingsRef   = useRef(settings)
  const textColorRef  = useRef(effectiveTextColor)
  const showingRawRef = useRef(showingRaw)
  const fontFamilyRef = useRef(fontFamily)

  tlRef.current         = videoTimeline
  framesRef.current     = preFrames
  masksRef.current      = preMasks
  preFpsRef.current     = preFps
  settingsRef.current   = settings
  textColorRef.current  = effectiveTextColor
  showingRawRef.current = showingRaw
  fontFamilyRef.current = fontFamily

  // ── Non-video frame acquisition ────────────────────────────────────────────
  useEffect(() => {
    if (!source || source.isAnimated || isVideo) return
    let active = true
    source.getFrame().then(f => { if (active) setFrame(f) })
    return () => { active = false }
  }, [source, isVideo])

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

  // Mask for non-video sources.
  useEffect(() => {
    if (!frame || isVideo) return
    let active = true
    const timer = setTimeout(() => {
      setStatus('masking')
      resolveMask(frame, { maskMode, maskTolerance })
        .then(({ mask: m }) => { if (active) { setMask(m); setStatus('ready') } })
        .catch(() => { if (active) setStatus('error') })
    }, 80)
    return () => { active = false; clearTimeout(timer) }
  }, [frame, maskMode, maskTolerance, isVideo])

  // ── Live grid for image / livefeed (SVG vector output) ──────────────────────
  const liveGrid = useMemo(() => {
    if (isVideo || !frame || !mask) return null
    return computeCharField(frame, mask, {
      aspectRatio:  effectiveSettings.aspectRatio,
      imageFit:     effectiveSettings.imageFit,
      rotation:     effectiveSettings.rotation,
      cellSize:     effectiveSettings.cellSize,
      contrast:     effectiveSettings.contrast,
      invert:       effectiveSettings.invert,
      glyphSet:     effectiveSettings.glyphSet,
    })
  }, [
    isVideo, frame, mask,
    effectiveSettings.aspectRatio, effectiveSettings.imageFit, effectiveSettings.rotation,
    effectiveSettings.cellSize, effectiveSettings.contrast, effectiveSettings.invert, effectiveSettings.glyphSet,
  ])

  // ── Video PLAYING: imperative rAF loop ──────────────────────────────────────
  // Reads the precise playhead ref (not throttled React state), picks the
  // pre-extracted frame/mask, samples keyframes at that exact time, and paints
  // to the canvas. No React re-render, no SVG layout.
  useEffect(() => {
    if (!isVideo) return
    let raf
    const loop = () => {
      const tl = tlRef.current
      const frames = framesRef.current
      if (tl?.playing && frames.length) {
        const t   = tl.playheadRef.current
        const idx = Math.max(0, Math.min(Math.round(t * preFpsRef.current), frames.length - 1))
        const f   = frames[idx]
        const m   = masksRef.current[idx]
        const s   = { ...settingsRef.current, ...(tl.sampleAt(t) || {}) }
        paintVideoFrame(videoCanvasRef.current, f, m, s, fontFamilyRef.current, textColorRef.current, showingRawRef.current)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isVideo])

  // ── Video PAUSED / scrubbing / tweaking: single-frame paint via effect ──────
  useEffect(() => {
    if (!isVideo || playing) return
    const f = preFrames[videoFrameIndex] ?? null
    const m = preMasks[videoFrameIndex] ?? null
    paintVideoFrame(videoCanvasRef.current, f, m, effectiveSettings, fontFamily, effectiveTextColor, showingRaw)
  }, [
    isVideo, playing, videoFrameIndex, preFrames, preMasks,
    effectiveSettings, effectiveTextColor, showingRaw, fontFamily,
  ])

  // Reset transform when image fit changes.
  useEffect(() => { setTransform({ x: 0, y: 0, scale: 1 }) }, [imageFit])

  // ── Raw-input canvas for IMAGE / LIVEFEED (SVG path) ────────────────────────
  useEffect(() => {
    if (isVideo || !frame || !rawCanvasRef.current || !liveGrid) return
    const canvas = rawCanvasRef.current
    const ctx    = canvas.getContext('2d')

    const outW = liveGrid.cols * CELL_ASPECT
    const outH = liveGrid.rows
    const dpr  = window.devicePixelRatio || 1
    const pxW  = Math.round(outW * dpr * 100)
    const pxH  = Math.round(outH * dpr * 100)

    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width  = pxW
      canvas.height = pxH
      canvas.style.aspectRatio = `${outW} / ${outH}`
      ctx.setTransform(dpr * 100, 0, 0, dpr * 100, 0, 0)
    }

    const cw = outW
    const ch = outH
    const fw = frame.width
    const fh = frame.height
    const fit = effectiveSettings.imageFit === 'cover'
      ? Math.max(cw / fw, ch / fh)
      : Math.min(cw / fw, ch / fh)
    const sw = fw * fit
    const sh = fh * fit
    const dx = (cw - sw) / 2
    const dy = (ch - sh) / 2

    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(frame.canvas, dx, dy, sw, sh)
  }, [isVideo, frame, liveGrid, effectiveSettings.imageFit])

  // ── Hold detection ─────────────────────────────────────────────────────────
  const HOLD_DELAY     = 350
  const MOVE_THRESHOLD = 8

  function onPointerDown(e) {
    if (e.button !== 0) return
    holdOriginRef.current = { x: e.clientX, y: e.clientY }
    holdTimerRef.current  = setTimeout(() => setHoldActive(true), HOLD_DELAY)
  }
  function onPointerMove(e) {
    if (!holdOriginRef.current) return
    const dx = e.clientX - holdOriginRef.current.x
    const dy = e.clientY - holdOriginRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
      clearTimeout(holdTimerRef.current)
      holdOriginRef.current = null
    }
  }
  function onPointerUp() {
    clearTimeout(holdTimerRef.current)
    holdOriginRef.current = null
    setHoldActive(false)
  }
  useEffect(() => () => clearTimeout(holdTimerRef.current), [])

  // ── Zoom button ────────────────────────────────────────────────────────────
  function scheduleButtonFade() {
    setButtonFaded(false)
    clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => setButtonFaded(true), 1500)
  }
  function resetTransform() {
    setTransform({ x: 0, y: 0, scale: 1 })
    setButtonFaded(false)
    clearTimeout(fadeTimerRef.current)
  }
  useEffect(() => () => clearTimeout(fadeTimerRef.current), [])

  useGesture(
    {
      onDrag: ({ offset: [x, y], dragging: d }) => {
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
      drag:   { from: () => [transform.x, transform.y] },
      pinch:  { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, from: () => [transform.scale, 0] },
      wheel:  { eventOptions: { passive: false } },
    },
  )

  const isZoomed = transform.scale !== 1
  const bgColor  = effectiveSettings.backgroundColor

  const showPrerenderOverlay = isVideo && preRendering
  const prerenderPct = Math.round(preProgress * 100)
  const hasVideoFrame = isVideo && preFrames.length > 0

  return (
    <div
      ref={containerRef}
      onDoubleClick={resetTransform}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={styles.component}
      style={{
        cursor:     dragging ? 'grabbing' : isZoomed ? 'grab' : 'default',
        userSelect: isZoomed ? 'none' : 'auto',
      }}
    >
      <div
        className={styles.transformLayer}
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {/* Video → single canvas (glyphs or raw) painted imperatively. */}
        {isVideo && hasVideoFrame && (
          <canvas
            ref={videoCanvasRef}
            className={styles.output}
            style={{ background: bgColor }}
          />
        )}

        {/* Image / livefeed → crisp SVG vector glyphs + raw-input canvas. */}
        {!isVideo && liveGrid && liveGrid.cols > 0 && (
          <svg
            viewBox={`0 0 ${liveGrid.cols * CELL_ASPECT} ${liveGrid.rows}`}
            preserveAspectRatio='xMidYMid meet'
            style={{ background: bgColor }}
            className={`${styles.output}${showingRaw ? ` ${styles.outputHidden}` : ''}`}
          >
            {liveGrid.lines.map((line, row) =>
              line.trim() === '' ? null : (
                <text
                  key={row}
                  x={0}
                  y={row + 0.78}
                  fontSize={1}
                  textLength={liveGrid.cols * CELL_ASPECT}
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

        {!isVideo && liveGrid && liveGrid.cols > 0 && (
          <canvas
            ref={rawCanvasRef}
            className={`${styles.output} ${styles.rawCanvas}${showingRaw ? ` ${styles.rawCanvasVisible}` : ''}`}
          />
        )}
      </div>

      {/* Pre-render overlay — shown while extracting frames and resolving masks.
          The first frame becomes visible behind it as soon as it's ready. */}
      {showPrerenderOverlay && (
        <div className={styles.prerenderOverlay}>
          <Loader size={28} />
          <span className={styles.prerenderLabel}>
            Preparing video…
          </span>
          <div className={styles.prerenderBar}>
            <div
              className={styles.prerenderBarFill}
              style={{ width: `${prerenderPct}%` }}
            />
          </div>
          <span className={styles.prerenderLabel} style={{ opacity: 0.55 }}>
            {prerenderPct}%
          </span>
        </div>
      )}

      {status === 'masking' && !showingRaw && !isVideo && (
        <span className={styles.badge}>Isolating subject…</span>
      )}

      {showingRaw && (
        <span className={styles.badge}>Input</span>
      )}

      {transform.scale !== 1 && !showingRaw && (
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
