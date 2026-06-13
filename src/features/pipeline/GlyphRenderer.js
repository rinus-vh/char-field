// Raster renderer: draws a computed glyph grid onto a canvas. Used for export
// (and any future video/live path where vector DOM would be too heavy). The
// vector viewport draws the same grid as SVG text instead.

import { computeGlyphGrid, CELL_ASPECT } from '@/features/pipeline/glyphGrid.js'

/**
 * @param {CanvasRenderingContext2D} ctx        output canvas context
 * @param {HTMLCanvasElement} stage             subject pixels (bg transparent)
 * @param {{
 *   cellSize: number,
 *   contrast: number,
 *   invert: boolean,
 *   glyphSet: string,
 *   textColor: string,
 *   fontFamily: string,
 * }} settings
 */
export function renderGlyphs(ctx, stage, settings) {
  const { cellSize, contrast, invert, glyphSet, textColor, fontFamily, gridWidth, gridHeight } = settings
  const { cols, rows, lines } = computeGlyphGrid(stage, { cellSize, contrast, invert, glyphSet, gridWidth, gridHeight })
  if (cols < 1 || rows < 1) return

  const ow = ctx.canvas.width
  const oh = ctx.canvas.height
  const cellW = ow / cols
  const cellH = oh / rows

  ctx.fillStyle = textColor
  ctx.font = `${Math.round(cellH)}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < rows; row++) {
    const line = lines[row]
    const cy = row * cellH + cellH / 2
    for (let col = 0; col < cols; col++) {
      const glyph = line[col]
      if (glyph === ' ') continue
      ctx.fillText(glyph, col * cellW + cellW / 2, cy)
    }
  }
}

export { CELL_ASPECT }
