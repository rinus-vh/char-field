import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { createImageInputSource, createLiveFeedInputSource, createVideoInputSource } from '@/features/pipeline/InputSource.js'
import { autoTextColor } from '@/features/pipeline/colorUtils.js'

import { DEFAULTS, SETTINGS_SECTIONS } from '@/constants/charFieldDefaults.js'
import { CharFieldContext } from './CharFieldContext.jsx'

const ZOOM_DEFAULT = 1

export function CharFieldContextProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  // committedSettings is a snapshot taken when the user finishes interacting with a
  // control (pointer-up on a slider, or instantly for toggles/dropdowns). The
  // viewport uses this to know when to kick off an expensive video pre-render,
  // rather than re-rendering on every intermediate value while dragging.
  const [committedSettings, setCommittedSettings] = useState(DEFAULTS)
  const settingsRef = useRef(settings)
  // Keep the ref in sync with the latest committed render so commitSettings() reads
  // current settings from event callbacks (which always fire after this effect).
  useLayoutEffect(() => { settingsRef.current = settings })
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
