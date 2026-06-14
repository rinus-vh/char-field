// Video and image-sequence export for char-field video sources.
// Frames + masks have already been extracted by useVideoPrerender; this module
// steps through them, applies current settings (and any keyframe overrides at
// each point in time via sampleAt), and either records a video file or
// assembles a PNG zip.

import { createZip } from './zip.js'
import { buildSubjectStage, fillBackground } from './OutputCompositor.js'
import { renderGlyphs } from './GlyphRenderer.js'

// Must match OutputCompositor's OUTPUT_LONG_EDGE so the exported glyph density
// is identical to what the user sees in the viewport.
const PREVIEW_LONG_EDGE = 1000

function parseRatio(ratio) {
  if (ratio === 'source') return null
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h) return null
  return [w, h]
}

function getDimensions(ratio, sourceW, sourceH, longEdge) {
  const parsed = parseRatio(ratio)
  const rw = parsed ? parsed[0] : sourceW
  const rh = parsed ? parsed[1] : sourceH
  const scale = longEdge / Math.max(rw, rh)
  return {
    width:  Math.max(1, Math.round(rw * scale)),
    height: Math.max(1, Math.round(rh * scale)),
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function pickVideoMime() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return 'video/webm'
}

const extForMime = m => (m.startsWith('video/mp4') ? 'mp4' : 'webm')

// Paint a single glyph frame onto the canvas at full export resolution, using
// preview-sized grid dimensions to keep glyph density consistent with the viewport.
function paintExportFrame(canvas, frame, mask, s, fontFamily, textColor, previewW, previewH) {
  const ctx = canvas.getContext('2d')
  fillBackground(ctx, s.backgroundColor)
  const stage = buildSubjectStage(frame, mask, canvas.width, canvas.height, s.rotation, s.imageFit ?? 'contain')
  renderGlyphs(ctx, stage, {
    cellSize:  s.cellSize,
    contrast:  s.contrast,
    invert:    s.invert,
    glyphSet:  s.glyphSet,
    textColor,
    fontFamily,
    gridWidth:  previewW,
    gridHeight: previewH,
  })
}

// Return the pre-extracted frame index closest to playhead time t.
function nearestFrameIdx(t, extractionFps, frameCount) {
  return Math.max(0, Math.min(Math.round(t * extractionFps), frameCount - 1))
}

/**
 * Export the char-field video as an MP4/WebM file.
 *
 * Renders each export frame deterministically — no WebGL, no R3F settle hacks.
 * Runs at real-time speed (frameDuration ms per frame) so MediaRecorder sees a
 * correctly-paced captureStream.
 *
 * @param {{
 *   frames:           Frame[],
 *   masks:            Mask[],
 *   settings:         object,
 *   sampleAt:         (t: number) => object,
 *   duration:         number,
 *   extractionFps:    number,
 *   exportFps:        number,
 *   longEdge:         number,
 *   effectiveTextColor: string,
 *   onProgress?:      (0‒1) => void,
 * }} opts
 */
export async function exportCharFieldVideo({
  frames, masks, settings, sampleAt, duration, extractionFps, exportFps,
  longEdge, effectiveTextColor, onProgress,
}) {
  const fontFamily = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-family-alt').trim() || 'monospace'

  const { width: outW, height: outH }       = getDimensions(settings.aspectRatio, frames[0].width, frames[0].height, longEdge)
  const { width: previewW, height: previewH } = getDimensions(settings.aspectRatio, frames[0].width, frames[0].height, PREVIEW_LONG_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width  = outW
  canvas.height = outH

  const mime     = pickVideoMime()
  const stream   = canvas.captureStream(exportFps)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 40_000_000 })
  const chunks   = []
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  const finished = new Promise(res => { recorder.onstop = res })

  const totalFrames   = Math.max(1, Math.round(duration * exportFps))
  const frameDuration = 1000 / exportFps

  // Paint the first frame before starting so the recorder captures from t=0.
  const s0  = { ...settings, ...(sampleAt(0) || {}) }
  const idx0 = nearestFrameIdx(0, extractionFps, frames.length)
  paintExportFrame(canvas, frames[idx0], masks[idx0], s0, fontFamily, effectiveTextColor, previewW, previewH)
  recorder.start()

  for (let i = 0; i < totalFrames; i++) {
    const t   = i / exportFps
    const idx = nearestFrameIdx(t, extractionFps, frames.length)
    const s   = { ...settings, ...(sampleAt(t) || {}) }
    paintExportFrame(canvas, frames[idx], masks[idx], s, fontFamily, effectiveTextColor, previewW, previewH)
    // Pace at exportFps so captureStream can latch each frame correctly.
    await new Promise(r => setTimeout(r, frameDuration))
    onProgress?.((i + 1) / totalFrames)
  }

  recorder.stop()
  await finished

  const blob = new Blob(chunks, { type: mime })
  triggerDownload(blob, `char-field.${extForMime(mime)}`)
  return extForMime(mime)
}

/**
 * Export the char-field video as a PNG image sequence inside a .zip file.
 *
 * Uses the pre-extracted frames (at extractionFps) — one exported PNG per
 * extracted frame — so the sequence length equals frames.length, not
 * duration × some higher fps.
 *
 * @param {{
 *   frames:           Frame[],
 *   masks:            Mask[],
 *   settings:         object,
 *   sampleAt:         (t: number) => object,
 *   duration:         number,
 *   longEdge:         number,
 *   effectiveTextColor: string,
 *   onProgress?:      (0‒1) => void,
 * }} opts
 */
export async function exportCharFieldSequence({
  frames, masks, settings, sampleAt, duration,
  longEdge, effectiveTextColor, onProgress,
}) {
  const fontFamily = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-family-alt').trim() || 'monospace'

  const { width: outW, height: outH }       = getDimensions(settings.aspectRatio, frames[0].width, frames[0].height, longEdge)
  const { width: previewW, height: previewH } = getDimensions(settings.aspectRatio, frames[0].width, frames[0].height, PREVIEW_LONG_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width  = outW
  canvas.height = outH

  const fileList = []
  const total    = frames.length

  for (let i = 0; i < total; i++) {
    const t = total > 1 ? (i / (total - 1)) * duration : 0
    const s = { ...settings, ...(sampleAt(t) || {}) }
    paintExportFrame(canvas, frames[i], masks[i], s, fontFamily, effectiveTextColor, previewW, previewH)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
    fileList.push({
      name: `frame_${String(i).padStart(4, '0')}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    })
    onProgress?.((i + 1) / total)
  }

  triggerDownload(createZip(fileList), 'char-field-sequence.zip')
}
