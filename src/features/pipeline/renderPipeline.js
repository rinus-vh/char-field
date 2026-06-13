// Orchestrates the four pipeline stages. This is the only place that wires the
// stages together; each stage stays unaware of the others.
//
// The work is split into two steps so callers can cache the expensive one:
//   resolveMask()    — detect mode + run the MaskProvider (can be slow: AI seg)
//   drawCharField()  — stage + background + glyphs (cheap, re-run on every tweak)
//
// Works identically for an image frame today and for video/live frames later —
// the caller just supplies a different Frame.

import { detectBackground } from './detectBackground.js'
import { getMaskProvider } from './maskProviders/index.js'
import { buildSubjectStage, fillBackground, getOutputDimensions } from './OutputCompositor.js'
import { renderGlyphs } from './GlyphRenderer.js'
import { computeGlyphGrid } from './glyphGrid.js'

/**
 * Resolves the mask mode (handling 'auto' + segmentation fallback) and produces
 * the subject mask for a frame.
 *
 * @param {import('./types.js').Frame} frame
 * @param {{ maskMode: string, maskTolerance: number }} options
 * @returns {Promise<{ mask: import('./types.js').Mask, resolvedMode: string }>}
 */
export async function resolveMask(frame, { maskMode, maskTolerance }) {
  let mode = maskMode
  let keyColor
  if (mode === 'auto') {
    const detected = detectBackground(frame)
    mode = detected.mode
    keyColor = detected.keyColor
  }

  try {
    const mask = await getMaskProvider(mode).generate(frame, { tolerance: maskTolerance, keyColor })
    return { mask, resolvedMode: mode }
  } catch (err) {
    // Segmentation can fail (no network for model/WASM, unsupported GPU). Degrade
    // to colour keying so the user still gets output.
    if (mode === 'segmentation') {
      const mask = await getMaskProvider('colorKey').generate(frame, { tolerance: maskTolerance, keyColor })
      return { mask, resolvedMode: 'segmentation-fallback' }
    }
    throw err
  }
}

/**
 * Draws the final composition: solid background + glyph subject. Pure with
 * respect to the mask — no mask generation here.
 *
 * @param {HTMLCanvasElement} targetCanvas
 * @param {import('./types.js').Frame} frame
 * @param {import('./types.js').Mask} mask
 * @param {object} settings
 */
export function drawCharField(targetCanvas, frame, mask, settings) {
  const {
    aspectRatio, rotation, backgroundColor, textColor,
    cellSize, contrast, invert, glyphSet, fontFamily,
  } = settings

  const { width: outW, height: outH } = getOutputDimensions(aspectRatio, frame.width, frame.height)
  targetCanvas.width = outW
  targetCanvas.height = outH

  const ctx = targetCanvas.getContext('2d')
  fillBackground(ctx, backgroundColor)

  const stage = buildSubjectStage(frame, mask, outW, outH, rotation)
  renderGlyphs(ctx, stage, { cellSize, contrast, invert, glyphSet, textColor, fontFamily })
}

/**
 * Computes the glyph grid for the vector viewport: stage the masked subject, then
 * sample it into rows of characters. No canvas painting — the viewport renders the
 * returned grid as crisp, infinitely-zoomable SVG text. Cheap; re-run on any tweak.
 *
 * @param {import('./types.js').Frame} frame
 * @param {import('./types.js').Mask} mask
 * @param {object} settings
 * @returns {{ cols: number, rows: number, lines: string[] }}
 */
export function computeCharField(frame, mask, settings) {
  const { aspectRatio, rotation, cellSize, contrast, invert, glyphSet } = settings
  const { width: outW, height: outH } = getOutputDimensions(aspectRatio, frame.width, frame.height)
  const stage = buildSubjectStage(frame, mask, outW, outH, rotation)
  return computeGlyphGrid(stage, { cellSize, contrast, invert, glyphSet })
}

/** Convenience: full pipeline in one call (no mask caching). */
export async function renderCharField(targetCanvas, frame, settings) {
  const { mask, resolvedMode } = await resolveMask(frame, settings)
  drawCharField(targetCanvas, frame, mask, settings)
  return { resolvedMode }
}
