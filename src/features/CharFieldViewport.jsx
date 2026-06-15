import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGesture } from '@use-gesture/react'
import { Loader } from '@6njp/prototype-library'

import { resolveMask, computeCharField } from '@/features/pipeline/renderPipeline.js'
import { getOutputDimensions, fillBackground, buildSubjectStage } from '@/features/pipeline/OutputCompositor.js'
import { renderGlyphs } from '@/features/pipeline/GlyphRenderer.js'
import { CELL_ASPECT } from '@/features/pipeline/glyphGrid.js'

import { useCharFieldContext } from '@/contexts/CharFieldContext.jsx'
import { useVideoTimelineContext } from '@/contexts/VideoTimelineContext.jsx'
import { useVideoPrerenderContext } from '@/contexts/VideoPrerenderContext.jsx'

import styles from './CharFieldViewport.module.css'

const MIN_SCALE = 1
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
  const { source, settings, committedSettings, effectiveTextColor, zoom, setZoom, resetZoom } = useCharFieldContext()
  const videoTimeline = useVideoTimelineContext()

  // ── Non-video frame state ──────────────────────────────────────────────────
  const [frame,  setFrame]  = useState(null)
  const [mask,   setMask]   = useState(null)
  const [status, setStatus] = useState('idle')

  // ── Transform / UI state ───────────────────────────────────────────────────
  // zoom (scale) lives in CharFieldContext so the settings panel can control it.
  // Pan (x/y) stays local — the settings panel doesn't need it.
  const [pan,      setPan]      = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [holdActive, setHoldActive] = useState(false)

  const containerRef   = useRef(null)
  const rawCanvasRef   = useRef(null)
  const videoCanvasRef = useRef(null)
  const holdTimerRef   = useRef(null)
  const holdOriginRef  = useRef(null)

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

  // Keep the mutable refs current for the rAF render loop without re-rendering.
  useLayoutEffect(() => {
    tlRef.current         = videoTimeline
    framesRef.current     = preFrames
    masksRef.current      = preMasks
    preFpsRef.current     = preFps
    settingsRef.current   = settings
    textColorRef.current  = effectiveTextColor
    showingRawRef.current = showingRaw
    fontFamilyRef.current = fontFamily
  })

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

  // ── Live mask re-compute for video (paused, mask settings being tweaked) ────
  // When the user drags the tolerance slider or switches mask mode, the committed
  // mask settings haven't changed yet so the pre-extracted masks still use the
  // old values. Re-mask just the current frame with the live settings so the
  // viewport shows an instant preview before the full re-extraction fires.
  const [liveVideoMask, setLiveVideoMask] = useState(null)

  // A live tweak is in progress when the working mask settings differ from the
  // committed ones (and we're paused on a video). Derive it in render so we never
  // need to reset state from inside the effect.
  const liveMaskActive =
    isVideo && !playing &&
    (settings.maskMode !== committedSettings.maskMode ||
     settings.maskTolerance !== committedSettings.maskTolerance)

  useEffect(() => {
    if (!liveMaskActive) return
    const frame = preFrames[videoFrameIndex] ?? null
    if (!frame) return
    let active = true
    resolveMask(frame, { maskMode: settings.maskMode, maskTolerance: settings.maskTolerance })
      .then(({ mask }) => { if (active) setLiveVideoMask(mask) })
    return () => { active = false }
  }, [
    liveMaskActive,
    settings.maskMode, settings.maskTolerance,
    videoFrameIndex, preFrames,
  ])

  // Only surface the live mask while a tweak is active; otherwise fall back to the
  // committed pre-extracted mask. Gating here keeps any stale value out of play.
  const effectiveLiveMask = liveMaskActive ? liveVideoMask : null

  // ── Video PAUSED / scrubbing / tweaking: single-frame paint via effect ──────
  useEffect(() => {
    if (!isVideo || playing) return
    const f = preFrames[videoFrameIndex] ?? null
    // Prefer the live-remasked version when mask settings are being tweaked.
    const m = effectiveLiveMask ?? preMasks[videoFrameIndex] ?? null
    paintVideoFrame(videoCanvasRef.current, f, m, effectiveSettings, fontFamily, effectiveTextColor, showingRaw)
  }, [
    isVideo, playing, videoFrameIndex, preFrames, preMasks, effectiveLiveMask,
    effectiveSettings, effectiveTextColor, showingRaw, fontFamily,
  ])

  // Reset pan when image fit changes (render-time derived reset for local state).
  const [prevImageFit, setPrevImageFit] = useState(imageFit)
  if (imageFit !== prevImageFit) {
    setPrevImageFit(imageFit)
    setPan({ x: 0, y: 0 })
  }
  // Zoom lives in context, so its reset can't run during render — do it in an effect.
  useEffect(() => { resetZoom() }, [imageFit, resetZoom])

  // When zoom is snapped back to 1 (e.g. from the settings panel), also reset pan.
  const [prevZoom, setPrevZoom] = useState(zoom)
  if (zoom !== prevZoom) {
    setPrevZoom(zoom)
    if (zoom === 1) setPan({ x: 0, y: 0 })
  }

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

  // Returns the max pan offset for the current zoom so content can't be dragged
  // beyond the point where the viewport edge aligns with the content edge.
  function panBounds(z) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { maxX: Infinity, maxY: Infinity }
    return {
      maxX: (rect.width  * (z - 1)) / 2,
      maxY: (rect.height * (z - 1)) / 2,
    }
  }

  function clampPan(x, y, z) {
    const { maxX, maxY } = panBounds(z)
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }

  function applyZoom(newZoom) {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newZoom))
    if (clamped === 1) { resetZoom(); return } // zoom effect above will reset pan
    setZoom(clamped)
    // Re-clamp pan at the new zoom level.
    setPan(p => clampPan(p.x, p.y, clamped))
  }

  useGesture(
    {
      onDrag: ({ offset: [x, y], dragging: d }) => {
        if (zoom <= 1) return
        setDragging(d)
        setPan(clampPan(x, y, zoom))
      },
      onPinch: ({ offset: [scale] }) => applyZoom(scale),
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault()
        applyZoom(zoom * (1 - dy * 0.002))
      },
    },
    {
      target: containerRef,
      drag:   { from: () => [pan.x, pan.y] },
      pinch:  { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, from: () => [zoom, 0] },
      wheel:  { eventOptions: { passive: false } },
    },
  )

  const isZoomed = zoom !== 1
  const bgColor  = effectiveSettings.backgroundColor

  const showPrerenderOverlay = isVideo && preRendering
  const prerenderPct = Math.round(preProgress * 100)
  const hasVideoFrame = isVideo && preFrames.length > 0

  return (
    <div
      ref={containerRef}
      onDoubleClick={() => { resetZoom() }}
      onPointerCancel={onPointerUp}
      style={{
        cursor: dragging ? 'grabbing' : isZoomed ? 'grab' : 'default',
        userSelect: isZoomed ? 'none' : 'auto',
      }}
      className={styles.component}
      {...{ onPointerDown, onPointerMove, onPointerUp }}
    >
      <div
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        className={styles.transformLayer}
      >
        {/* Video → single canvas (glyphs or raw) painted imperatively. */}
        {isVideo && hasVideoFrame && (
          <canvas
            ref={videoCanvasRef}
            style={{ background: bgColor }}
            className={styles.output}
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
              style={{ width: `${prerenderPct}%` }}
              className={styles.prerenderBarFill}
            />
          </div>
          <span style={{ opacity: 0.55 }} className={styles.prerenderLabel}>
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

    </div>
  )
}
