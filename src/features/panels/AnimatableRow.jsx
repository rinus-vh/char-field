import { useState } from 'react'
import { EyeOff, Eye, Plus, Trash2 } from 'lucide-react'
import { PanelContainerSettingsRow, ContextMenu } from '@6njp/prototype-library'

import { useVideoTimelineContext } from '@/contexts/VideoTimelineContext.jsx'

import styles from './AnimatableRow.module.css'

/**
 * Drop-in replacement for PanelContainerSettingsRow for settings that can be
 * animated on the video timeline. When `standalone` is true it wraps children
 * in a plain div instead — for full-width controls like Slider that already
 * render their own label row.
 *
 * - Shows a coloured dot when a track exists for this path.
 * - Dot is dimmed when the track is muted (base setting shows in the viewport).
 * - Click the dot to toggle muted state.
 * - Right-click the row/wrapper for a context menu: add keyframe, disable/enable
 *   track, remove track.
 *
 * When `path` is omitted, or no video is loaded, it behaves exactly like the
 * underlying element it wraps.
 */
export function AnimatableRow({ label, path, value, standalone = false, children }) {
  const timeline = useVideoTimelineContext()
  const track = (path && timeline) ? timeline.tracks.find(t => t.path === path) : null

  const [menu, setMenu] = useState(null) // { x, y }

  // When there's no video or no path, render the plain row/wrapper with no extras.
  if (!path || !timeline?.isVideo) {
    if (standalone) return <>{children}</>
    
    return <PanelContainerSettingsRow {...{ label }}>{children}</PanelContainerSettingsRow>
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const menuItems = []

  if (value !== undefined) {
    menuItems.push({
      label: 'Add keyframe at current time',
      icon: <Plus size={12} />,
      onClick: () => timeline.addOrUpdateKeyframe(path, label, timeline.playhead, value),
    })
  }

  if (track) {
    if (menuItems.length) menuItems.push({ divider: true })
    menuItems.push({
      label: track.muted ? 'Reactivate track' : 'Disable track',
      icon: track.muted ? <Eye size={12} /> : <EyeOff size={12} />,
      onClick: () => timeline.setTrackMuted(track.id, !track.muted),
    })
    menuItems.push({
      label: 'Remove track',
      icon: <Trash2 size={12} />,
      onClick: () => timeline.removeTrack(track.id),
    })
  }

  const dot = track ? (
    <button
      type='button'
      onClick={e => { e.stopPropagation(); timeline.setTrackMuted(track.id, !track.muted) }}
      title={track.muted ? 'Track disabled — click to reactivate' : 'Has keyframes — click to disable'}
      className={cx(styles.dot, track.muted && styles.dotMuted)}
    />
  ) : null

  if (standalone) {
    return (
      <>
        <div onContextMenu={handleContextMenu} className={styles.standaloneWrapper}>
          {dot && <span className={styles.standaloneDot}>{dot}</span>}
          {children}
        </div>

        {menu && menuItems.length > 0 && (
          <ContextMenu
            isOpen
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
            items={menuItems}
          />
        )}
      </>
    )
  }

  return (
    <>
      <PanelContainerSettingsRow onContextMenu={handleContextMenu} {...{ label }}>
        {dot}
        {children}
      </PanelContainerSettingsRow>

      {menu && menuItems.length > 0 && (
        <ContextMenu
          isOpen
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={menuItems}
        />
      )}
    </>
  )
}
