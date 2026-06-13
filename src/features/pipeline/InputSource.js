// InputSource implementations. Only image upload is implemented for now; video
// upload and live camera will add their own factories returning the same shape
// (see types.js → InputSource). The rest of the pipeline only ever sees Frames,
// so it does not care which source produced them.

// Cap the processing resolution so mask generation and pixel sampling stay fast
// regardless of how large the uploaded image is. The glyph grid is far coarser
// than this anyway, so detail is not lost.
const MAX_PROCESS_EDGE = 1024

/** @param {HTMLImageElement|ImageBitmap} bitmap */
function drawToFittedCanvas(bitmap, srcW, srcH) {
  const scale = Math.min(1, MAX_PROCESS_EDGE / Math.max(srcW, srcH))
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)

  return { canvas, width, height }
}

// Reads the alpha channel to decide whether the source is genuinely transparent.
// PNGs are always RGBA, so presence of an alpha channel is not enough — we check
// for any actually-transparent pixel.
function detectAlpha(canvas) {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(0, 0, width, height)
  // Sample sparsely — one in every N pixels is plenty to detect transparency.
  const step = Math.max(1, Math.floor((width * height) / 20000))
  for (let i = 3; i < data.length; i += 4 * step) {
    if (data[i] < 250) return true
  }
  return false
}

/**
 * @param {File} file
 * @returns {Promise<import('./types.js').InputSource>}
 */
export async function createImageInputSource(file) {
  const url = URL.createObjectURL(file)
  let bitmap
  let srcW
  let srcH
  try {
    bitmap = await createImageBitmap(file)
    srcW = bitmap.width
    srcH = bitmap.height
  } catch {
    bitmap = await loadImageElement(url)
    srcW = bitmap.naturalWidth
    srcH = bitmap.naturalHeight
  }

  const { canvas, width, height } = drawToFittedCanvas(bitmap, srcW, srcH)
  if (bitmap.close) bitmap.close()
  const hasAlpha = detectAlpha(canvas)

  const frame = { canvas, width, height, hasAlpha }

  return {
    kind: 'image',
    isAnimated: false,
    getFrame: async () => frame,
    dispose: () => URL.revokeObjectURL(url),
  }
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
