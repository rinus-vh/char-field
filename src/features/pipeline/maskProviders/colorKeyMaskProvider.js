// Keys out a clean, near-uniform background by colour distance. The key colour is
// detected from the frame border (the dominant edge colour) unless one is
// supplied, so it works for pure-white, pure-black, or any flat backdrop.
//
// Tolerance controls how far a pixel's colour may sit from the key before it is
// still considered background. A soft band around the threshold yields a feathered
// edge rather than a hard cut, which reads better as glyph density.

import { detectBackground } from '@/features/pipeline/detectBackground.js'

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

/** @returns {import('../types.js').MaskProvider} */
export function createColorKeyMaskProvider() {
  return {
    id: 'colorKey',
    /**
     * @param {import('../types.js').Frame} frame
     * @param {{ tolerance?: number, keyColor?: [number, number, number] }} options
     */
    async generate(frame, { tolerance = 0.18, keyColor } = {}) {
      const { canvas, width, height } = frame
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const { data } = ctx.getImageData(0, 0, width, height)

      const [kr, kg, kb] = keyColor ?? detectBackground(frame).keyColor

      // Map 0..1 tolerance onto a colour-distance threshold. Max RGB distance is
      // ~441; we cap the usable range so the slider stays expressive.
      const threshold = tolerance * 220
      const feather = Math.max(8, threshold * 0.4)

      const mask = new Uint8ClampedArray(width * height)
      for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
        const dist = colorDistance(data[i], data[i + 1], data[i + 2], kr, kg, kb)
        // Below threshold → background (0). Above threshold + feather → subject (255).
        // In between → linear ramp for a soft edge.
        let v
        if (dist <= threshold) v = 0
        else if (dist >= threshold + feather) v = 255
        else v = Math.round(((dist - threshold) / feather) * 255)
        mask[p] = v
      }
      return { data: mask, width, height }
    },
  }
}
