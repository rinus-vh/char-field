// Keyframe interpolation helpers — adapted from mesh-stage.

const lerp = (a, b, t) => a + (b - a) * t

function hexToRgb(hex) {
  const h = hex.slice(1)
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')
}

function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) }

function interpValue(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t)
  if (isHex(a) && isHex(b)) {
    const ca = hexToRgb(a)
    const cb = hexToRgb(b)
    return rgbToHex([lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)])
  }
  return a // booleans and enums hold (step)
}

/**
 * Sample a sorted keyframe array at `time`. Clamps outside the range.
 * @param {{ time: number, value: unknown }[]} keyframes sorted ascending
 */
export function sampleTrack(keyframes, time) {
  if (!keyframes.length) return undefined
  if (time <= keyframes[0].time) return keyframes[0].value
  const last = keyframes[keyframes.length - 1]
  if (time >= last.time) return last.value
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i]
    const k1 = keyframes[i + 1]
    if (time >= k0.time && time <= k1.time) {
      const span = k1.time - k0.time
      const t = span === 0 ? 0 : (time - k0.time) / span
      return interpValue(k0.value, k1.value, t)
    }
  }
  return last.value
}
