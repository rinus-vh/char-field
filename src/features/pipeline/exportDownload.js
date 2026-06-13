// Renders the char field at a chosen export resolution and triggers a browser
// download. Separate from the viewport path so resolution and format can be
// picked independently without affecting the live preview.

import { resolveMask } from '@/features/pipeline/renderPipeline.js'
import { buildSubjectStage, fillBackground } from '@/features/pipeline/OutputCompositor.js'
import { renderGlyphs } from '@/features/pipeline/GlyphRenderer.js'

function parseRatio(ratio) {
  if (ratio === 'source') return null
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h) return null
  return [w, h]
}

function getExportDimensions(ratio, sourceW, sourceH, longEdge) {
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

  const { width: outW, height: outH } = getExportDimensions(
    aspectRatio,
    frame.width,
    frame.height,
    longEdge,
  )

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
  })

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const dataUrl = canvas.toDataURL(mimeType, quality)

  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `char-field-${longEdge}.${ext}`
  a.click()
}
