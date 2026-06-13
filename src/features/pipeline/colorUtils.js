// Small colour helpers shared by the settings UI and the pipeline.

/** @param {string} hex e.g. '#1a2b3c' or '#abc' */
export function hexToRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const int = parseInt(h, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

/** Relative luminance (0..1) for WCAG-style contrast decisions. */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const toLinear = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// Picks black or white text for maximum legibility against a background colour.
export function autoTextColor(backgroundHex) {
  return relativeLuminance(backgroundHex) > 0.45 ? '#000000' : '#ffffff'
}
