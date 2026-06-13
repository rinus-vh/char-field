// AI subject segmentation via Google MediaPipe (@mediapipe/tasks-vision). Used
// when the background is not a clean key-able colour. The heavy WASM runtime and
// the model are loaded lazily on first use and the package is dynamically
// imported, so neither the bundle nor startup pay for it unless segmentation is
// actually selected.
//
// MediaPipe is deliberately confined to this module — no other pipeline stage
// imports it. The generate() contract is identical to the other providers, which
// keeps the door open to move this work into a Web Worker later (the tasks-vision
// runtime is worker-compatible) without changing any caller.

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite'

let segmenterPromise = null

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision')
      const { FilesetResolver, ImageSegmenter } = vision
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })
    })().catch((err) => {
      // Allow a later retry if the first attempt failed (e.g. transient network).
      segmenterPromise = null
      throw err
    })
  }
  return segmenterPromise
}

// Nearest-neighbour resample of a category mask into the frame's resolution, so
// the returned Mask aligns 1:1 with everything else in the pipeline.
function resampleToFrame(categories, srcW, srcH, dstW, dstH) {
  const out = new Uint8ClampedArray(dstW * dstH)
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y / dstH) * srcH))
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x / dstW) * srcW))
      // deeplab category 0 is background; any other class is treated as subject.
      out[y * dstW + x] = categories[sy * srcW + sx] === 0 ? 0 : 255
    }
  }
  return out
}

/** @returns {import('../types.js').MaskProvider} */
export function createSegmentationMaskProvider() {
  return {
    id: 'segmentation',
    async generate(frame) {
      const { canvas, width, height } = frame
      const segmenter = await getSegmenter()
      const result = segmenter.segment(canvas)
      const categoryMask = result.categoryMask
      const categories = categoryMask.getAsUint8Array()
      const data = resampleToFrame(
        categories, categoryMask.width, categoryMask.height, width, height,
      )
      categoryMask.close()
      return { data, width, height }
    },
    dispose() {
      // Keep the loaded model around for reuse; it is process-global by design.
    },
  }
}
