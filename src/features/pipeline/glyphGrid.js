// Samples the masked subject stage into a grid of special characters. This is the
// pure, renderer-agnostic core: it produces one string per row (a space marks an
// empty cell), which both the vector viewport (SVG text) and the raster exporter
// (canvas) draw from. It reads only pixels and knows nothing about how the mask
// was made or how the output is presented.

import { getGlyphRamp } from '@/features/pipeline/glyphSets.js'

// Monospace cells are taller than they are wide. This ratio sets the character
// grid's aspect so glyphs sit on a natural type baseline grid, and is reused by
// the viewport to size its SVG so columns and rows stay square to the output.
export const CELL_ASPECT = 0.55

// Cells whose subject coverage is below this are treated as background and left
// blank, giving a clean silhouette edge.
const COVERAGE_CUTOFF = 0.32

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

/**
 * @param {HTMLCanvasElement} stage  subject pixels at output resolution (bg transparent)
 * @param {{
 *   cellSize: number,
 *   contrast: number,
 *   invert: boolean,
 *   glyphSet: string,
 * }} settings
 * @returns {{ cols: number, rows: number, lines: string[] }}
 */
/**
 * @param {HTMLCanvasElement} stage  subject pixels at output resolution (bg transparent)
 * @param {{
 *   cellSize: number,
 *   contrast: number,
 *   invert: boolean,
 *   glyphSet: string,
 *   gridWidth?: number,   optional override for cols/rows calculation (e.g. preview size)
 *   gridHeight?: number,  so export at 4× resolution keeps the same grid density
 * }} settings
 * @returns {{ cols: number, rows: number, lines: string[] }}
 */
export function computeGlyphGrid(stage, settings) {
  const { cellSize, contrast, invert, glyphSet, gridWidth, gridHeight } = settings
  const ramp = getGlyphRamp(glyphSet)

  const ow = stage.width
  const oh = stage.height

  // Grid density is calculated against gridWidth/gridHeight when provided so that
  // an export at a higher resolution uses the same cols/rows as the viewport preview.
  const refW = gridWidth ?? ow
  const refH = gridHeight ?? oh

  const cellW = Math.max(2, cellSize * CELL_ASPECT)
  const cellH = Math.max(2, cellSize)
  const cols = Math.floor(refW / cellW)
  const rows = Math.floor(refH / cellH)
  if (cols < 1 || rows < 1) return { cols: 0, rows: 0, lines: [] }

  // Scale cell dimensions from reference space into actual pixel space.
  const pxCellW = cellW * (ow / refW)
  const pxCellH = cellH * (oh / refH)
  const offsetX = (ow - cols * pxCellW) / 2
  const offsetY = (oh - rows * pxCellH) / 2

  const ctx = stage.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(0, 0, ow, oh)

  // How many source pixels to step per cell when averaging — keeps cost bounded.
  const sampleStep = Math.max(1, Math.floor(Math.min(pxCellW, pxCellH) / 4))

  const lines = []
  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * pxCellH + offsetY)
    const y1 = Math.max(y0 + 1, Math.floor((row + 1) * pxCellH + offsetY))

    let line = ''
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * pxCellW + offsetX)
      const x1 = Math.max(x0 + 1, Math.floor((col + 1) * pxCellW + offsetX))

      let alphaSum = 0
      let lumSum = 0
      let samples = 0
      for (let y = y0; y < y1 && y < oh; y += sampleStep) {
        for (let x = x0; x < x1 && x < ow; x += sampleStep) {
          const i = (y * ow + x) * 4
          const a = data[i + 3] / 255
          alphaSum += a
          lumSum += a * (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
          samples++
        }
      }

      const coverage = samples ? alphaSum / samples : 0
      if (coverage < COVERAGE_CUTOFF) { line += ' '; continue }

      const lum = lumSum / Math.max(alphaSum, 1e-4)
      // Dark subject pixels → dense glyphs. Stretch around mid-grey by contrast.
      let t = clamp((1 - lum - 0.5) * contrast + 0.5, 0, 1)
      if (invert) t = 1 - t
      // Feathered edges (partial coverage) lean lighter for a softer silhouette.
      t *= 0.45 + 0.55 * coverage

      const glyph = ramp[Math.round(t * (ramp.length - 1))]
      line += glyph === ' ' ? ' ' : glyph
    }
    lines.push(line)
  }

  return { cols, rows, lines }
}
