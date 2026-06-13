// Renders the char field at a chosen export resolution and triggers a browser
// download. Separate from the viewport path so resolution and format can be
// picked independently without affecting the live preview.

import { resolveMask } from '@/features/pipeline/renderPipeline.js'
import { buildSubjectStage, fillBackground } from '@/features/pipeline/OutputCompositor.js'
import { renderGlyphs } from '@/features/pipeline/GlyphRenderer.js'

// Must match OutputCompositor's OUTPUT_LONG_EDGE so the exported grid density is
// identical to what the user sees in the viewport.
const PREVIEW_LONG_EDGE = 1000

function parseRatio(ratio) {
  if (ratio === 'source') return null
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h) return null
  return [w, h]
}

function getDimensions(ratio, sourceW, sourceH, longEdge) {
  const parsed = parseRatio(ratio)
  let rw = parsed ? parsed[0] : sourceW
  let rh = parsed ? parsed[1] : sourceH
  const scale = longEdge / Math.max(rw, rh)
  return {
    width: Math.max(1, Math.round(rw * scale)),
    height: Math.max(1, Math.round(rh * scale)),
  }
}

/**
 * @param {{
 *   source: import('./types.js').InputSource,
 *   settings: object,
 *   aspectRatio: string,
 *   longEdge: number,
 *   format: 'png' | 'jpeg',
 *   quality: number,
 *   effectiveTextColor: string,
 * }} options
 */
export async function exportDownload({ source, settings, aspectRatio, longEdge, format, quality, effectiveTextColor }) {
  const frame = await source.getFrame()
  const { mask } = await resolveMask(frame, {
    maskMode: settings.maskMode,
    maskTolerance: settings.maskTolerance,
  })

  // Full-resolution canvas — this is what gets downloaded.
  const { width: outW, height: outH } = getDimensions(aspectRatio, frame.width, frame.height, longEdge)

  // Preview-resolution dims — used only to lock grid density to what the viewport shows.
  // Without this, a 4× resolution export would produce a 4× denser character grid.
  const { width: previewW, height: previewH } = getDimensions(aspectRatio, frame.width, frame.height, PREVIEW_LONG_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH

  const ctx = canvas.getContext('2d')
  fillBackground(ctx, settings.backgroundColor)

  const stage = buildSubjectStage(frame, mask, outW, outH, settings.rotation)
  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue('--font-family-alt').trim() ||
    'monospace'

  renderGlyphs(ctx, stage, {
    cellSize: settings.cellSize,
    contrast: settings.contrast,
    invert: settings.invert,
    glyphSet: settings.glyphSet,
    textColor: effectiveTextColor,
    fontFamily,
    gridWidth: previewW,
    gridHeight: previewH,
  })

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const ext = format === 'jpeg' ? 'jpg' : 'png'

  await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('toBlob failed')); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `char-field-${longEdge}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      resolve()
    }, mimeType, quality)
  })
}
