// Shared type definitions for the character-field pipeline.
//
// The pipeline is intentionally split into four decoupled stages so the same
// output path can later be driven by video frames and a live camera feed:
//
//   InputSource  →  MaskProvider  →  GlyphRenderer  →  OutputCompositor
//
// Every stage speaks in plain data (canvases, typed arrays, plain settings
// objects) and never imports another stage, so any one can be swapped or moved
// to a Web Worker without touching the others.

/**
 * A single still frame produced by an InputSource. For an image this is produced
 * once; for video/live it is produced per animation tick.
 *
 * @typedef {Object} Frame
 * @property {HTMLCanvasElement} canvas  RGBA pixel data at processing resolution
 * @property {number} width
 * @property {number} height
 * @property {boolean} hasAlpha  whether the original source carried transparency
 */

/**
 * A subject mask: one coverage byte per pixel (0 = background, 255 = subject),
 * row-major, matching the Frame resolution it was generated from.
 *
 * @typedef {Object} Mask
 * @property {Uint8ClampedArray} data
 * @property {number} width
 * @property {number} height
 */

/**
 * Produces frames. Images are static (isAnimated false); video and live camera
 * implementations set isAnimated true and return the current frame on demand.
 *
 * @typedef {Object} InputSource
 * @property {'image'|'video'|'camera'} kind
 * @property {boolean} isAnimated
 * @property {() => Promise<Frame>} getFrame
 * @property {() => void} dispose
 */

/**
 * Turns a Frame into a subject Mask. Stateless from the caller's perspective;
 * may hold internal resources (e.g. a loaded segmentation model) released via
 * dispose.
 *
 * @typedef {Object} MaskProvider
 * @property {string} id
 * @property {(frame: Frame, options: object) => Promise<Mask>} generate
 * @property {() => void} [dispose]
 */

export {}
