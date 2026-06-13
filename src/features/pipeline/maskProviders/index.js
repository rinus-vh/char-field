// MaskProvider registry. Providers are created lazily and cached so expensive
// ones (segmentation) keep their loaded state across renders.

import { createAlphaMaskProvider } from './alphaMaskProvider.js'
import { createColorKeyMaskProvider } from './colorKeyMaskProvider.js'
import { createSegmentationMaskProvider } from './segmentationMaskProvider.js'

const FACTORIES = {
  alpha: createAlphaMaskProvider,
  colorKey: createColorKeyMaskProvider,
  segmentation: createSegmentationMaskProvider,
}

export const MASK_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto (detect)' },
  { value: 'alpha', label: 'Transparency' },
  { value: 'colorKey', label: 'Background key' },
  { value: 'segmentation', label: 'AI segmentation' },
]

const cache = new Map()

/** @param {'alpha'|'colorKey'|'segmentation'} id */
export function getMaskProvider(id) {
  if (!cache.has(id)) {
    const factory = FACTORIES[id]
    if (!factory) throw new Error(`Unknown mask provider: ${id}`)
    cache.set(id, factory())
  }
  return cache.get(id)
}
