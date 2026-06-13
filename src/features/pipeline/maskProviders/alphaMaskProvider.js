// Uses the source's own alpha channel as the subject mask. The cleanest possible
// input: a cut-out PNG with a transparent background.

/** @returns {import('../types.js').MaskProvider} */
export function createAlphaMaskProvider() {
  return {
    id: 'alpha',
    async generate(frame) {
      const { canvas, width, height } = frame
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const { data } = ctx.getImageData(0, 0, width, height)
      const mask = new Uint8ClampedArray(width * height)
      for (let p = 0, i = 3; p < mask.length; p++, i += 4) {
        mask[p] = data[i]
      }
      return { data: mask, width, height }
    },
  }
}
