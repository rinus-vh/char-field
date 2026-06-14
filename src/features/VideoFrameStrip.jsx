import { useEffect, useRef, useState } from 'react'

import styles from './VideoFrameStrip.module.css'

/**
 * VideoFrameStrip — renders a horizontal strip of evenly-spaced video
 * thumbnail frames onto a canvas. Passed as children to <Trim> so the
 * selection handles and playhead layer on top.
 *
 * @param {{
 *   file: File,
 *   duration: number,
 *   playhead?: number,
 *   height?: number,
 *   layoutClassName?: string,
 * }} props
 */
export function VideoFrameStrip({
  file,
  duration,
  playhead = undefined,
  height = 80,
  layoutClassName = undefined,
}) {
  const wrapperRef = useRef(null)
  const canvasRef  = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    setWidth(Math.round(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!file || !width || !height || !duration) return
    let cancelled = false

    const video = document.createElement('video')
    const url   = URL.createObjectURL(file)
    video.muted   = true
    video.preload = 'auto'
    video.src     = url  // set src after preload so the browser respects the hint
    video.load()

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width  = Math.round(width  * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, width, height)

    const frameCount = Math.max(2, Math.round(width / (height * (16 / 9))))

    // Wait until the video has enough metadata to know its dimensions and allow seeking.
    async function waitUntilSeeakable() {
      if (video.readyState >= 1) return // HAVE_METADATA
      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        video.addEventListener('error', reject, { once: true })
      })
    }

    // Seek to a time and resolve only once the frame is decoded and ready to draw.
    // We add the listener BEFORE setting currentTime so there is no race window.
    // We do NOT use a sync currentTime fallback — Chrome updates currentTime
    // synchronously but fires 'seeked' only after the frame is decoded, so
    // resolving early would cause drawImage to paint a stale frame.
    function seekTo(t) {
      return new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true })
        video.currentTime = t
      })
    }

    async function extractFrames() {
      await waitUntilSeeakable()
      if (cancelled) return

      const fw = width  / frameCount
      const fh = height

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) break
        // Distribute evenly across the clip, avoiding exact 0 (may be black).
        const t = ((i + 0.5) / frameCount) * duration
        await seekTo(t)
        if (cancelled) break

        const vw = video.videoWidth  || 1
        const vh = video.videoHeight || 1
        const scale = Math.max(fw / vw, fh / vh)
        const sw = vw * scale
        const sh = vh * scale
        const sx = (fw - sw) / 2
        const sy = (fh - sh) / 2
        ctx.drawImage(video, i * fw + sx, sy, sw, sh)
      }
      URL.revokeObjectURL(url)
    }

    extractFrames().catch(() => URL.revokeObjectURL(url))

    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file, duration, width, height])

  const playheadPct = typeof playhead === 'number' && duration > 0
    ? `${Math.max(0, Math.min(1, playhead / duration)) * 100}%`
    : null

  return (
    <div
      ref={wrapperRef}
      className={`${styles.component}${layoutClassName ? ` ${layoutClassName}` : ''}`}
      style={{ height }}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {playheadPct && (
        <div className={styles.playhead} style={{ left: playheadPct }} />
      )}
    </div>
  )
}
