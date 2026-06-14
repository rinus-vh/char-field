import { useState } from 'react'
import {
  PanelContainer, PanelContainerSettingsRow, PanelContainerDivider,
  Dropdown, Button, LabelSm,
} from '@6njp/prototype-library'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { useVideoTimeline } from '@/features/contexts/VideoTimelineContext.jsx'
import { useVideoPrerenderContext } from '@/features/contexts/VideoPrerenderContext.jsx'
import { exportDownload } from '@/features/pipeline/exportDownload.js'
import { exportCharFieldVideo, exportCharFieldSequence } from '@/features/pipeline/exportVideoFile.js'

import styles from './ExportPanelContent.module.css'

// ── Shared option lists ───────────────────────────────────────────────────────

const ASPECT_OPTIONS = [
  { value: 'current', label: 'Same as output' },
  { value: '1:1',     label: 'Square 1:1' },
  { value: '4:3',     label: 'Landscape 4:3' },
  { value: '3:4',     label: 'Portrait 3:4' },
  { value: '3:2',     label: 'Landscape 3:2' },
  { value: '2:3',     label: 'Portrait 2:3' },
  { value: '16:9',    label: 'Wide 16:9' },
  { value: '9:16',    label: 'Tall 9:16' },
]

const RESOLUTION_OPTIONS = [
  { value: 1080, label: '1080px' },
  { value: 2160, label: '2160px (2×)' },
  { value: 4320, label: '4320px (4×)' },
]

// ── Image export options ──────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  { value: 'png',  label: 'PNG (lossless)' },
  { value: 'jpeg', label: 'JPEG (compressed)' },
]

const QUALITY_OPTIONS = [
  { value: 0.92, label: 'High' },
  { value: 0.75, label: 'Medium' },
  { value: 0.5,  label: 'Low' },
]

// ── Video export options ──────────────────────────────────────────────────────

const VIDEO_FORMAT_OPTIONS = [
  { value: 'video',    label: 'Video (.mp4 / .webm)' },
  { value: 'sequence', label: 'Image sequence (.png zip)' },
]

const VIDEO_FPS_OPTIONS = [
  { value: 24, label: '24 fps' },
  { value: 30, label: '30 fps' },
]

// ─────────────────────────────────────────────────────────────────────────────

export function ExportPanelContent() {
  const { source, settings, effectiveTextColor } = useCharField()
  const { isVideo, sampleAt, duration }          = useVideoTimeline() ?? {}
  const prerender                                = useVideoPrerenderContext()

  // Shared
  const [aspectRatio, setAspectRatio] = useState('current')
  const [longEdge,    setLongEdge]    = useState(2160)
  const [status,      setStatus]      = useState(null)
  const [busy,        setBusy]        = useState(false)
  const [progress,    setProgress]    = useState(null) // 0-1 during video export

  // Image-only
  const [imgFormat, setImgFormat] = useState('png')
  const [quality,   setQuality]   = useState(0.92)

  // Video-only
  const [videoFormat, setVideoFormat] = useState('video')
  const [exportFps,   setExportFps]   = useState(24)

  function resolvedAspect() {
    return aspectRatio === 'current' ? settings.aspectRatio : aspectRatio
  }

  // ── Image / livefeed export ────────────────────────────────────────────────
  async function handleImageExport() {
    if (!source) {
      setStatus('Load an image first')
      setTimeout(() => setStatus(null), 3000)
      return
    }
    setBusy(true)
    setStatus('Rendering…')
    try {
      await exportDownload({
        source,
        settings,
        effectiveTextColor,
        aspectRatio: resolvedAspect(),
        longEdge,
        format: imgFormat,
        quality,
      })
      setStatus('Downloaded ✓')
    } catch (err) {
      console.error('Export failed:', err)
      setStatus('Export failed — see console')
    }
    setBusy(false)
    setTimeout(() => setStatus(null), 3000)
  }

  // ── Video export ───────────────────────────────────────────────────────────
  async function handleVideoExport() {
    const { frames, masks, fps: extractionFps } = prerender ?? {}
    if (!frames?.length || !masks?.length) {
      setStatus('Video not ready yet — wait for pre-render to finish')
      setTimeout(() => setStatus(null), 4000)
      return
    }

    setBusy(true)
    setProgress(0)
    setStatus(videoFormat === 'sequence' ? 'Rendering frames…' : 'Recording video…')

    const opts = {
      frames,
      masks,
      settings: { ...settings, aspectRatio: resolvedAspect() },
      sampleAt:  sampleAt ?? (() => ({})),
      duration:  duration ?? 0,
      extractionFps,
      longEdge,
      effectiveTextColor,
      onProgress: p => setProgress(p),
    }

    try {
      if (videoFormat === 'sequence') {
        await exportCharFieldSequence(opts)
      } else {
        await exportCharFieldVideo({ ...opts, exportFps })
      }
      setStatus('Downloaded ✓')
    } catch (err) {
      console.error('Video export failed:', err)
      setStatus('Export failed — see console')
    }

    setBusy(false)
    setProgress(null)
    setTimeout(() => setStatus(null), 3000)
  }

  const handleExport = isVideo ? handleVideoExport : handleImageExport

  const progressLabel = progress != null ? ` ${Math.round(progress * 100)}%` : ''
  const busyLabel     = videoFormat === 'sequence' ? `Rendering…${progressLabel}` : `Recording…${progressLabel}`

  return (
    <div className={styles.component}>
      <PanelContainer>
        {/* Aspect ratio — shared */}
        <PanelContainerSettingsRow label='Aspect ratio'>
          <div className={styles.dropdownSlot}>
            <Dropdown value={aspectRatio} onChange={setAspectRatio} options={ASPECT_OPTIONS} />
          </div>
        </PanelContainerSettingsRow>

        {/* Resolution — shared */}
        <PanelContainerSettingsRow label='Resolution'>
          <div className={styles.dropdownSlot}>
            <Dropdown value={longEdge} onChange={setLongEdge} options={RESOLUTION_OPTIONS} />
          </div>
        </PanelContainerSettingsRow>

        {/* Image-only options */}
        {!isVideo && (
          <>
            <PanelContainerSettingsRow label='Format'>
              <div className={styles.dropdownSlot}>
                <Dropdown value={imgFormat} onChange={setImgFormat} options={FORMAT_OPTIONS} />
              </div>
            </PanelContainerSettingsRow>

            {imgFormat === 'jpeg' && (
              <PanelContainerSettingsRow label='Quality'>
                <div className={styles.dropdownSlot}>
                  <Dropdown value={quality} onChange={setQuality} options={QUALITY_OPTIONS} />
                </div>
              </PanelContainerSettingsRow>
            )}
          </>
        )}

        {/* Video-only options */}
        {isVideo && (
          <>
            <PanelContainerSettingsRow label='Output'>
              <div className={styles.dropdownSlot}>
                <Dropdown value={videoFormat} onChange={setVideoFormat} options={VIDEO_FORMAT_OPTIONS} />
              </div>
            </PanelContainerSettingsRow>

            {videoFormat === 'video' && (
              <PanelContainerSettingsRow label='Frame rate'>
                <div className={styles.dropdownSlot}>
                  <Dropdown value={exportFps} onChange={setExportFps} options={VIDEO_FPS_OPTIONS} />
                </div>
              </PanelContainerSettingsRow>
            )}
          </>
        )}
      </PanelContainer>

      {(status || progress != null) && (
        <LabelSm layoutClassName={styles.statusLayout}>
          {status}{progressLabel}
        </LabelSm>
      )}

      <Button
        label={busy ? busyLabel : 'Download'}
        onClick={busy ? undefined : handleExport}
        layoutClassName={styles.downloadButtonLayout}
      />
    </div>
  )
}
