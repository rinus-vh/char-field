// InputSource implementations. Only image upload is implemented for now; video
// upload and live camera will add their own factories returning the same shape
// (see types.js → InputSource). The rest of the pipeline only ever sees Frames,
// so it does not care which source produced them.

// Cap the processing resolution so mask generation and pixel sampling stay fast
// regardless of how large the uploaded image is. The glyph grid is far coarser
// than this anyway, so detail is not lost.
const MAX_PROCESS_EDGE = 1024

// Video frames are pre-extracted in bulk (hundreds per clip) and re-masked /
// re-sampled on every playback frame, so they run at a lower resolution than
// stills. ASCII output is coarse, so the loss of detail is invisible while the
// memory and per-frame cost drop ~4×.
const VIDEO_PROCESS_EDGE = 540

/** @param {HTMLImageElement|ImageBitmap|HTMLVideoElement} bitmap */
function drawToFittedCanvas(bitmap, srcW, srcH, maxEdge = MAX_PROCESS_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
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

/**
 * Wraps a live MediaStream so the pipeline can sample it frame-by-frame.
 * Each getFrame() call draws the current video frame into a fresh canvas —
 * the viewport polls this on an interval to drive the live char-field render.
 *
 * @param {MediaStream} stream
 * @returns {import('./types.js').InputSource}
 */
export function createLiveFeedInputSource(stream) {
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  video.autoplay = true

  // Returns a snapshot of the current video frame, downscaled to MAX_PROCESS_EDGE.
  async function getFrame() {
    // Wait until video dimensions are known (first frame arrived).
    if (!video.videoWidth) {
      await new Promise(resolve => { video.addEventListener('loadeddata', resolve, { once: true }) })
    }
    const { canvas, width, height } = drawToFittedCanvas(video, video.videoWidth, video.videoHeight)
    return { canvas, width, height, hasAlpha: false }
  }

  return {
    kind: 'livefeed',
    isAnimated: true,
    getFrame,
    dispose: () => {
      stream.getTracks().forEach(t => t.stop())
      video.srcObject = null
    },
  }
}

/**
 * Wraps a video File with an optional trim window. The timeline drives playback
 * by calling getFrame(relativeTime) — the time is in seconds relative to the
 * trim start, so 0 is the first frame and (trimEnd - trimStart) is the last.
 *
 * @param {File} file
 * @param {number} trimStart seconds in the original clip
 * @param {number} trimEnd   seconds in the original clip
 * @returns {import('./types.js').InputSource}
 */
export function createVideoInputSource(file, trimStart, trimEnd) {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.preload = 'auto'

  // Wait until the video is seekable before the first getFrame.
  const readyPromise = new Promise(resolve => {
    if (video.readyState >= 2) { resolve(); return }
    video.addEventListener('loadeddata', resolve, { once: true })
  })

  async function seekTo(absTime) {
    if (Math.abs(video.currentTime - absTime) < 0.016) return
    video.currentTime = absTime
    await new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true })
    })
  }

  async function getFrame(relativeTime = 0) {
    await readyPromise
    const absTime = trimStart + Math.max(0, Math.min(relativeTime, trimEnd - trimStart))
    await seekTo(absTime)
    const { canvas, width, height } = drawToFittedCanvas(video, video.videoWidth, video.videoHeight, VIDEO_PROCESS_EDGE)
    return { canvas, width, height, hasAlpha: false }
  }

  return {
    kind: 'video',
    isAnimated: false, // timeline-driven; the rAF loop in VideoTimelineContext owns playback
    duration: trimEnd - trimStart,
    getFrame,
    dispose: () => {
      video.src = ''
      URL.revokeObjectURL(url)
    },
  }
}
