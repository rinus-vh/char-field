import { Download, ImageOff, RotateCcw, RotateCw } from 'lucide-react'
import {
  PanelContainer, PanelContainerSettingsRow,
  PanelContainerSettingsSectionHeader,
  ActionIconButton,
  Slider, Dropdown, Checkbox, ColorInput, GhostButton,
} from '@6njp/prototype-library'

import { useCharField, DEFAULTS, SETTINGS_SECTIONS } from '@/features/contexts/CharFieldContext.jsx'
import { useVideoTimeline } from '@/features/contexts/VideoTimelineContext.jsx'
import { MASK_MODE_OPTIONS } from '@/features/pipeline/maskProviders/index.js'
import { GLYPH_SET_OPTIONS } from '@/features/pipeline/glyphSets.js'

import styles from './SettingsContent.module.css'

const VIEWPORT_FIT_OPTIONS = [
  { value: 'contain', label: 'Fit' },
  { value: 'cover', label: 'Cover' },
]

const ASPECT_OPTIONS = [
  { value: 'source', label: 'Source' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '3:2', label: 'Landscape 3:2' },
  { value: '2:3', label: 'Portrait 2:3' },
  { value: '16:9', label: 'Wide 16:9' },
  { value: '9:16', label: 'Tall 9:16' },
]

function isSectionDirty(settings, section) {
  return SETTINGS_SECTIONS[section].some(k => settings[k] !== DEFAULTS[k])
}

export function SettingsContent({ onOpenExport }) {
  const { settings, update, commitSettings, resetSection, source, clearSource, effectiveTextColor } = useCharField()
  const timeline = useVideoTimeline()

  // When the video timeline is in recording mode, setting changes are also
  // stored as keyframes at the current playhead position.
  function rec(path, label, value) {
    update({ [path]: value })
    timeline?.record(path, label, value)
  }

  // Instant-commit for controls that don't drag (toggles, dropdowns, buttons).
  function recAndCommit(path, label, value) {
    rec(path, label, value)
    commitSettings()
  }

  function updateAndCommit(patch) {
    update(patch)
    commitSettings()
  }

  const usesColorKey = settings.maskMode === 'auto' || settings.maskMode === 'colorKey'

  return (
    <div className={styles.component}>

      <Section title='Output' dirty={isSectionDirty(settings, 'output')} onReset={() => resetSection('output')}>
        <PanelContainer>
          <PanelContainerSettingsRow label='Aspect ratio'>
            <div className={styles.dropdownSlot}>
              <Dropdown
                value={settings.aspectRatio}
                onChange={v => updateAndCommit({ aspectRatio: v })}
                options={ASPECT_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
          <PanelContainerSettingsRow label='Image fit'>
            <div className={styles.dropdownSlot}>
              <Dropdown
                value={settings.imageFit}
                onChange={v => updateAndCommit({ imageFit: v })}
                options={VIEWPORT_FIT_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
          <PanelContainerSettingsRow label='Show raw input'>
            <Checkbox checked={settings.showRawInput} onChange={v => update({ showRawInput: v })} />
          </PanelContainerSettingsRow>
          <PanelContainerSettingsRow label={`Rotation ${settings.rotation}°`}>
            <ActionIconButton
              icon={RotateCcw}
              onClick={() => update({ rotation: (settings.rotation + 270) % 360 })}
              title='Rotate 90° left'
              size={20}
              style='outline'
            />
            <ActionIconButton
              icon={RotateCw}
              onClick={() => update({ rotation: (settings.rotation + 90) % 360 })}
              title='Rotate 90° right'
              size={20}
              style='outline'
            />
          </PanelContainerSettingsRow>
        </PanelContainer>
      </Section>

      <Section title='Color' dirty={isSectionDirty(settings, 'color')} onReset={() => resetSection('color')}>
        <PanelContainer>
          <PanelContainerSettingsRow label='Background'>
            <ColorInput value={settings.backgroundColor} onChange={v => rec('backgroundColor', 'Background', v)} />
          </PanelContainerSettingsRow>

          <PanelContainerSettingsRow label='Automatic text color'>
            <Checkbox checked={settings.textColorAuto} onChange={v => update({ textColorAuto: v })} />
          </PanelContainerSettingsRow>

          <PanelContainerSettingsRow label={settings.textColorAuto ? 'Text color (auto)' : 'Text color'}>
            {settings.textColorAuto ? (
              <span style={{ background: effectiveTextColor }} title='Determined automatically by contrast' className={styles.swatch} />
            ) : (
              <ColorInput value={settings.textColorManual} onChange={v => update({ textColorManual: v, textColorAuto: false })} />
            )}
          </PanelContainerSettingsRow>
        </PanelContainer>

      </Section>

      <Section title='Masking' dirty={isSectionDirty(settings, 'masking')} onReset={() => resetSection('masking')}>
        <PanelContainer>
          <PanelContainerSettingsRow label='Mode'>
            <div className={styles.dropdownSlot}>
              <Dropdown
                value={settings.maskMode}
                onChange={v => updateAndCommit({ maskMode: v })}
                options={MASK_MODE_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
        </PanelContainer>

        {usesColorKey && (
          <Slider
            value={settings.maskTolerance}
            onChange={v => update({ maskTolerance: v })}
            onCommit={commitSettings}
            min={0.02}
            max={0.6}
            step={0.01}
            label='Background tolerance'
          />
        )}
        <p className={styles.hint}>
          {settings.maskMode === 'auto' && 'Detects transparency or a clean white/black background, falling back to AI.'}
          {settings.maskMode === 'alpha' && 'Uses the image’s own transparency as the subject.'}
          {settings.maskMode === 'colorKey' && 'Removes a clean, uniform background by colour. Raise tolerance to key more.'}
          {settings.maskMode === 'segmentation' && 'AI isolates the subject from any background (loads on first use).'}
        </p>
      </Section>

      <Section title='Glyphs' dirty={isSectionDirty(settings, 'glyphs')} onReset={() => resetSection('glyphs')}>
        <PanelContainer>
          <PanelContainerSettingsRow label='Character set'>
            <div className={styles.dropdownSlot}>
              <Dropdown
                value={settings.glyphSet}
                onChange={v => updateAndCommit({ glyphSet: v })}
                options={GLYPH_SET_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
          <PanelContainerSettingsRow label='Invert'>
            <Checkbox checked={settings.invert} onChange={v => recAndCommit('invert', 'Invert', v)} />
          </PanelContainerSettingsRow>
        </PanelContainer>

        <Slider
          value={settings.cellSize}
          onChange={v => rec('cellSize', 'Scale', v)}
          onCommit={commitSettings}
          min={4}
          max={28}
          step={1}
          label='Scale'
        />
        <Slider
          value={settings.contrast}
          onChange={v => rec('contrast', 'Contrast', v)}
          onCommit={commitSettings}
          min={0.5}
          max={3}
          step={0.1}
          label='Contrast'
        />
      </Section>

      <div className={styles.bottomActions}>
        <GhostButton
          label='Export settings'
          icon={Download}
          color='white'
          onClick={onOpenExport}
          layoutClassName={styles.fullButtonLayout}
        />
        {source && (
          <GhostButton
            label='Discard image'
            icon={ImageOff}
            color='orange'
            onClick={clearSource}
            layoutClassName={styles.fullButtonLayout}
          />
        )}
      </div>

    </div>
  )
}

function Section({ title, children, dirty = false, onReset }) {
  return (
    <div className={styles.componentSection}>
      <PanelContainerSettingsSectionHeader
        {...{ title, onReset }}
        isDirty={dirty}
      />
      <div className={styles.sectionBody}>{children}</div>
    </div>
  )
}

