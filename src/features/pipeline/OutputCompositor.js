// Final composition stage. Owns the output canvas geometry (aspect ratio,
// resolution) and builds the "subject stage" — the masked source pixels placed
// into the output frame with the chosen rotation and a contain-fit. The glyph
// renderer draws on top of a solid background filled here.

// Longest edge of the output canvas backing store. The canvas is scaled down by
// CSS to fit the panel; this fixed resolution keeps the glyph grid stable.
const OUTPUT_LONG_EDGE = 1000

/** @param {string} ratio e.g. '16:9' */
function parseRatio(ratio) {
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h) return [1, 1]
  return [w, h]
}

/**
 * Output canvas pixel dimensions for an aspect ratio, capped to OUTPUT_LONG_EDGE.
 * @param {string} ratio
 * @param {number} sourceW
 * @param {number} sourceH
 */
export function getOutputDimensions(ratio, sourceW = 1, sourceH = 1) {
  let rw
  let rh
  if (ratio === 'source') {
    rw = sourceW
    rh = sourceH
  } else {
    ;[rw, rh] = parseRatio(ratio)
  }
  const scale = OUTPUT_LONG_EDGE / Math.max(rw, rh)
  return {
    width: Math.max(1, Math.round(rw * scale)),
    height: Math.max(1, Math.round(rh * scale)),
  }
}

// Produces a fitted RGBA canvas at frame resolution where each pixel keeps the
// source colour but takes its alpha from the mask. This is the masked subject.
function buildMaskedFrame(frame, mask) {
  const { canvas, width, height } = frame
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const image = ctx.getImageData(0, 0, width, height)
  const out = new ImageData(width, height)
  for (let p = 0, i = 0; p < mask.data.length; p++, i += 4) {
    out.data[i] = image.data[i]
    out.data[i + 1] = image.data[i + 1]
    out.data[i + 2] = image.data[i + 2]
    out.data[i + 3] = mask.data[p]
  }
  const masked = document.createElement('canvas')
  masked.width = width
  masked.height = height
  masked.getContext('2d').putImageData(out, 0, 0)
  return masked
}

/**
 * Composes the masked subject into an output-sized stage canvas, applying
 * rotation (0/90/180/270) and a contain-fit.
 *
 * @param {import('./types.js').Frame} frame
 * @param {import('./types.js').Mask} mask
 * @param {number} outW
 * @param {number} outH
 * @param {number} rotation  degrees, multiple of 90
 * @returns {HTMLCanvasElement}
 */
export function buildSubjectStage(frame, mask, outW, outH, rotation) {
  const masked = buildMaskedFrame(frame, mask)

  const stage = document.createElement('canvas')
  stage.width = outW
  stage.height = outH
  const ctx = stage.getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, outW, outH)

  const rot = ((rotation % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  const effW = swap ? frame.height : frame.width
  const effH = swap ? frame.width : frame.height
  const fit = Math.min(outW / effW, outH / effH)

  ctx.save()
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.scale(fit, fit)
  ctx.drawImage(masked, -frame.width / 2, -frame.height / 2)
  ctx.restore()

  return stage
}

/**
 * Fills the output canvas with the solid background colour.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} backgroundColor
 */
export function fillBackground(ctx, backgroundColor) {
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}
