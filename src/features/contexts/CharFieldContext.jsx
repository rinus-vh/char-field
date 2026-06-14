import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { createImageInputSource, createLiveFeedInputSource, createVideoInputSource } from '@/features/pipeline/InputSource.js'
import { autoTextColor } from '@/features/pipeline/colorUtils.js'

// All tunable output settings live here so the viewport and the settings panel
// share one source of truth. Grouped by the settings-panel section they belong
// to, which also drives per-section reset.
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

const CharFieldContext = createContext(null)

export function CharFieldProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  // committedSettings is a snapshot taken when the user finishes interacting with a
  // control (pointer-up on a slider, or instantly for toggles/dropdowns). The
  // viewport uses this to know when to kick off an expensive video pre-render,
  // rather than re-rendering on every intermediate value while dragging.
  const [committedSettings, setCommittedSettings] = useState(DEFAULTS)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // extraPatch lets callers forward a patch that hasn't resolved through React
  // state yet (e.g. the same patch just passed to update()). Without it,
  // settingsRef.current still holds the pre-update value at call time.
  const commitSettings = useCallback((extraPatch) => {
    setCommittedSettings(extraPatch
      ? { ...settingsRef.current, ...extraPatch }
      : { ...settingsRef.current },
    )
  }, [])

  // Viewport zoom — lives here so the settings panel can read/write it.
  // Pan (x/y) stays local to the viewport since the settings panel doesn't need it.
  const ZOOM_DEFAULT = 1
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const resetZoom = useCallback(() => setZoom(ZOOM_DEFAULT), [])

  const [source, setSource] = useState(null)
  const [sourceName, setSourceName] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const sourceRef = useRef(null)

  const update = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  const resetSection = useCallback((section) => {
    const keys = SETTINGS_SECTIONS[section] ?? []
    setSettings(prev => {
      const next = { ...prev }
      for (const k of keys) next[k] = DEFAULTS[k]
      return next
    })
  }, [])

  const resetAll = useCallback(() => setSettings(DEFAULTS), [])

  // Loads an uploaded image as the active input source. The pipeline downstream
  // only sees the resulting InputSource, so swapping in video/live later means
  // calling a different factory here — nothing else changes.
  const loadImageFile = useCallback(async (file) => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await createImageInputSource(file)
      sourceRef.current?.dispose()
      sourceRef.current = next
      setSource(next)
      setSourceName(file.name)
    } catch (err) {
      setError(err?.message ?? 'Failed to load image')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadLiveFeed = useCallback(async (stream) => {
    setIsLoading(true)
    setError(null)
    try {
      const next = createLiveFeedInputSource(stream)
      sourceRef.current?.dispose()
      sourceRef.current = next
      setSource(next)
      setSourceName('Live feed')
    } catch (err) {
      setError(err?.message ?? 'Failed to start live feed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadVideoFile = useCallback(async (file, trimStart, trimEnd) => {
    setIsLoading(true)
    setError(null)
    try {
      const next = createVideoInputSource(file, trimStart, trimEnd)
      sourceRef.current?.dispose()
      sourceRef.current = next
      setSource(next)
      setSourceName(file.name)
    } catch (err) {
      setError(err?.message ?? 'Failed to load video')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearSource = useCallback(() => {
    sourceRef.current?.dispose()
    sourceRef.current = null
    setSource(null)
    setSourceName(null)
    setError(null)
  }, [])

  const effectiveTextColor = settings.textColorAuto
    ? autoTextColor(settings.backgroundColor)
    : settings.textColorManual

  const value = useMemo(() => ({
    settings, committedSettings, update, commitSettings, resetSection, resetAll,
    zoom, setZoom, resetZoom, ZOOM_DEFAULT,
    source, sourceName, isLoading, error,
    loadImageFile, loadLiveFeed, loadVideoFile, clearSource,
    effectiveTextColor,
  }), [settings, committedSettings, update, commitSettings, resetSection, resetAll, zoom, setZoom, resetZoom, source, sourceName, isLoading, error, loadImageFile, loadLiveFeed, loadVideoFile, clearSource, effectiveTextColor])

  return <CharFieldContext.Provider {...{ value }}>{children}</CharFieldContext.Provider>
}

export function useCharField() {
  const ctx = useContext(CharFieldContext)
  if (!ctx) throw new Error('useCharField must be used within CharFieldProvider')
  return ctx
}
