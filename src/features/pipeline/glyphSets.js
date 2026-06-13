// Character density ramps — ordered from lightest (sparse ink) to densest (solid
// ink). Only special characters are used; no letters or digits. The renderer maps
// a normalised subject darkness (0 = light, 1 = dark) onto an index in the ramp.

export const GLYPH_SETS = {
  classic: [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'],
  blocks: [' ', '.', ':', '+', '*', '%', '#', '@'],
  dots: [' ', '.', ':', '*', '%', '@'],
  dense: [' ', ':', '-', '=', '+', '*', '#', '%', '@', '@'],
}

export const GLYPH_SET_OPTIONS = [
  { value: 'classic', label: 'Classic  . : - = + * # % @' },
  { value: 'blocks', label: 'Blocks  . : + * % # @' },
  { value: 'dots', label: 'Dots  . : * % @' },
  { value: 'dense', label: 'Dense  : - = + * # % @' },
]

export function getGlyphRamp(name) {
  return GLYPH_SETS[name] ?? GLYPH_SETS.classic
}
