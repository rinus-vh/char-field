import { useState } from 'react'
import {
  PanelContainer, PanelContainerSettingsRow,
  Dropdown, Button, LabelSm,
} from '@6njp/prototype-library'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { exportDownload } from '@/features/pipeline/exportDownload.js'

import styles from './ExportPanelContent.module.css'

const ASPECT_OPTIONS = [
  { value: 'current', label: 'Same as output' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '3:2', label: 'Landscape 3:2' },
  { value: '2:3', label: 'Portrait 2:3' },
  { value: '16:9', label: 'Wide 16:9' },
  { value: '9:16', label: 'Tall 9:16' },
]

const RESOLUTION_OPTIONS = [
  { value: 1080, label: '1080px' },
  { value: 2160, label: '2160px (2×)' },
  { value: 4320, label: '4320px (4×)' },
]

const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG (lossless)' },
  { value: 'jpeg', label: 'JPEG (compressed)' },
]

const QUALITY_OPTIONS = [
  { value: 0.92, label: 'High' },
  { value: 0.75, label: 'Medium' },
  { value: 0.5, label: 'Low' },
]

export function ExportPanelContent() {
  const { source, settings, effectiveTextColor } = useCharField()

  const [aspectRatio, setAspectRatio] = useState('current')
  const [longEdge, setLongEdge] = useState(2160)
  const [format, setFormat] = useState('png')
  const [quality, setQuality] = useState(0.92)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
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
        aspectRatio: aspectRatio === 'current' ? settings.aspectRatio : aspectRatio,
        longEdge,
        format,
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

  return (
    <div className={styles.component}>
      <PanelContainer>
        <PanelContainerSettingsRow label='Aspect ratio'>
          <div className={styles.dropdownSlot}>
            <Dropdown
              value={aspectRatio}
              onChange={setAspectRatio}
              options={ASPECT_OPTIONS}
            />
          </div>
        </PanelContainerSettingsRow>

        <PanelContainerSettingsRow label='Resolution'>
          <div className={styles.dropdownSlot}>
            <Dropdown
              value={longEdge}
              onChange={setLongEdge}
              options={RESOLUTION_OPTIONS}
            />
          </div>
        </PanelContainerSettingsRow>

        <PanelContainerSettingsRow label='Format'>
          <div className={styles.dropdownSlot}>
            <Dropdown
              value={format}
              onChange={setFormat}
              options={FORMAT_OPTIONS}
            />
          </div>
        </PanelContainerSettingsRow>

        {format === 'jpeg' && (
          <PanelContainerSettingsRow label='Quality'>
            <div className={styles.dropdownSlot}>
              <Dropdown
                value={quality}
                onChange={setQuality}
                options={QUALITY_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
        )}
      </PanelContainer>

      {status && <LabelSm layoutClassName={styles.statusLayout}>{status}</LabelSm>}

      <Button
        label={busy ? 'Rendering…' : 'Download'}
        onClick={busy ? undefined : handleExport}
        layoutClassName={styles.downloadButtonLayout}
      />
    </div>
  )
}
