export const DEFAULTS = {
  // Output
  aspectRatio: '1:1',
  imageFit: 'contain',
  rotation: 0,
  // Background & text
  backgroundColor: '#f5e003',
  textColorAuto: true,
  textColorManual: '#000000',
  // Masking
  maskMode: 'auto',
  maskTolerance: 0.18,
  // Glyphs
  cellSize: 12,
  contrast: 1.4,
  invert: false,
  glyphSet: 'classic',
  // Preview
  showRawInput: false,
}

export const SETTINGS_SECTIONS = {
  output: ['aspectRatio', 'imageFit', 'rotation', 'showRawInput'],
  color: ['backgroundColor', 'textColorAuto', 'textColorManual'],
  masking: ['maskMode', 'maskTolerance'],
  glyphs: ['cellSize', 'contrast', 'invert', 'glyphSet'],
}
