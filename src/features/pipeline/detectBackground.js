// Inspects a frame's border to recommend a masking strategy. Used when the mask
// mode is set to "auto": transparent sources use their alpha channel, clean
// near-white / near-black backgrounds use colour keying, and anything else falls
// back to AI segmentation.

function relLuminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.4152 * b) / 255
}

/**
 * @param {import('./types.js').Frame} frame
 * @returns {{ mode: 'alpha'|'colorKey'|'segmentation', keyColor: [number, number, number], uniformity: number }}
 */
export function detectBackground(frame) {
  if (frame.hasAlpha) {
    return { mode: 'alpha', keyColor: [0, 0, 0], uniformity: 1 }
  }

  const { canvas, width, height } = frame
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(0, 0, width, height)

  // Walk a one-pixel-thick border ring and accumulate colour + variance.
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let count = 0
  const samples = []

  const consider = (x, y) => {
    const i = (y * width + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    sumR += r
    sumG += g
    sumB += b
    count++
    samples.push([r, g, b])
  }

  const stepX = Math.max(1, Math.floor(width / 64))
  const stepY = Math.max(1, Math.floor(height / 64))
  for (let x = 0; x < width; x += stepX) {
    consider(x, 0)
    consider(x, height - 1)
  }
  for (let y = 0; y < height; y += stepY) {
    consider(0, y)
    consider(width - 1, y)
  }

  const meanR = sumR / count
  const meanG = sumG / count
  const meanB = sumB / count

  // Variance of border colour around its mean — low variance means a clean,
  // uniform background that colour keying can isolate reliably.
  let variance = 0
  for (const [r, g, b] of samples) {
    variance += (r - meanR) ** 2 + (g - meanG) ** 2 + (b - meanB) ** 2
  }
  variance = Math.sqrt(variance / count)
  const uniformity = Math.max(0, 1 - variance / 80)

  const lum = relLuminance(meanR, meanG, meanB)
  const isNearWhite = lum > 0.82 && uniformity > 0.5
  const isNearBlack = lum < 0.12 && uniformity > 0.5

  if (isNearWhite || isNearBlack) {
    return { mode: 'colorKey', keyColor: [meanR, meanG, meanB], uniformity }
  }

  return { mode: 'segmentation', keyColor: [meanR, meanG, meanB], uniformity }
}
