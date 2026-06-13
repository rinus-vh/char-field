import { useState } from 'react'
import { Download, ImageOff, RotateCcw, RotateCw } from 'lucide-react'
import {
  PanelContainer, PanelContainerSettingsRow,
  Slider, Dropdown, Checkbox, ColorInput, Button, Modal,
  LabelUppercaseSm,
} from '@6njp/prototype-library'

import { useCharField, DEFAULTS, SETTINGS_SECTIONS } from '@/features/contexts/CharFieldContext.jsx'
import { MASK_MODE_OPTIONS } from '@/features/pipeline/maskProviders/index.js'
import { GLYPH_SET_OPTIONS } from '@/features/pipeline/glyphSets.js'

import styles from './SettingsContent.module.css'

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
  const { settings, update, resetSection, source, clearSource, effectiveTextColor } = useCharField()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const usesColorKey = settings.maskMode === 'auto' || settings.maskMode === 'colorKey'

  return (
    <div className={styles.component}>

      <Section title='Output' dirty={isSectionDirty(settings, 'output')} onReset={() => resetSection('output')}>
        <PanelContainer>
          <PanelContainerSettingsRow label='Aspect ratio'>
            <div className={styles.dropdownSlot}>
              <Dropdown
                value={settings.aspectRatio}
                onChange={v => update({ aspectRatio: v })}
                options={ASPECT_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
          <PanelContainerSettingsRow label={`Rotation ${settings.rotation}°`}>
            <button
              type='button'
              onClick={() => update({ rotation: (settings.rotation + 270) % 360 })}
              title='Rotate 90° left'
              className={styles.iconButton}
            >
              <RotateCcw size={13} />
            </button>
            <button
              type='button'
              onClick={() => update({ rotation: (settings.rotation + 90) % 360 })}
              title='Rotate 90° right'
              className={styles.iconButton}
            >
              <RotateCw size={13} />
            </button>
          </PanelContainerSettingsRow>
        </PanelContainer>
      </Section>

      <Section title='Color' dirty={isSectionDirty(settings, 'color')} onReset={() => resetSection('color')}>
        <PanelContainer>
          <PanelContainerSettingsRow label='Background'>
            <ColorInput value={settings.backgroundColor} onChange={v => update({ backgroundColor: v })} />
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
                onChange={v => update({ maskMode: v })}
                options={MASK_MODE_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
        </PanelContainer>

        {usesColorKey && (
          <Slider
            value={settings.maskTolerance}
            onChange={v => update({ maskTolerance: v })}
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
                onChange={v => update({ glyphSet: v })}
                options={GLYPH_SET_OPTIONS}
              />
            </div>
          </PanelContainerSettingsRow>
          <PanelContainerSettingsRow label='Invert'>
            <Checkbox checked={settings.invert} onChange={v => update({ invert: v })} />
          </PanelContainerSettingsRow>
        </PanelContainer>

        <Slider
          value={settings.cellSize}
          onChange={v => update({ cellSize: v })}
          min={4}
          max={28}
          step={1}
          label='Scale'
        />
        <Slider
          value={settings.contrast}
          onChange={v => update({ contrast: v })}
          min={0.5}
          max={3}
          step={0.1}
          label='Contrast'
        />
      </Section>

      {source && (
        <Section title='Image'>
          <Button
            label='Replace image'
            variant='outline'
            icon={ImageOff}
            onClick={() => setConfirmOpen(true)}
            layoutClassName={styles.fullButtonLayout}
          />
        </Section>
      )}

      <Section title='Export'>
        <Button
          label='Export settings'
          variant='solid'
          icon={Download}
          onClick={onOpenExport}
          layoutClassName={styles.fullButtonLayout}
        />
      </Section>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title='Replace image?'
      >
        <div className={styles.confirmBody}>
          <p className={styles.hint}>All adjustments you have made will be lost.</p>
          <div className={styles.confirmButtons}>
            <Button
              label='Cancel'
              variant='outline'
              onClick={() => setConfirmOpen(false)}
            />
            <Button
              label='Replace'
              onClick={() => { clearSource(); setConfirmOpen(false) }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, children, dirty = false, onReset }) {
  return (
    <div className={styles.componentSection}>
      <div className={styles.sectionHeader}>
        <LabelUppercaseSm layoutClassName={styles.sectionTitleLayout}>{title}</LabelUppercaseSm>

        {dirty && onReset && (
          <button
            type='button'
            onClick={onReset}
            title={`Reset ${title} to defaults`}
            className={styles.resetButton}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  )
}

