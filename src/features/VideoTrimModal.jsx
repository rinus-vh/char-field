import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Scissors, Pause, Play } from 'lucide-react'
import { ActionIconButton, Button, Icon, Trim } from '@6njp/prototype-library'

import { VideoFrameStrip } from '@/features/VideoFrameStrip.jsx'

import styles from './VideoTrimModal.module.css'

const MAX_TRIM_SECONDS = 15

function formatTime(s) {
  const sec = Math.max(0, s)
  const m   = Math.floor(sec / 60)
  const rem = sec - m * 60
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`
}

/**
 * VideoTrimModal — shown immediately after a video file is chosen.
 * Lets the user pick a ≤15 s window, audition it with play/pause,
 * then confirm before it feeds into the pipeline.
 */
export function VideoTrimModal({ file, duration, onConfirm, onCancel }) {
  const [selection, setSelection] = useState({
    start: 0,
    end:   Math.min(duration, MAX_TRIM_SECONDS),
  })
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  // Ref to the visible <video> element rendered in the JSX below.
  const videoRef     = useRef(null)
  const rafRef       = useRef(null)
  const selectionRef = useRef(selection)
  useLayoutEffect(() => { selectionRef.current = selection })

  // Wire the object URL to the visible video element once per file.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const url = URL.createObjectURL(file)
    video.preload = 'auto'
    video.src     = url
    video.load()

    return () => {
      video.pause()
      video.src = ''
      URL.revokeObjectURL(url)
      cancelAnimationFrame(rafRef.current)
    }
  }, [file])

  // rAF loop — reads video.currentTime and loops within the selection.
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    function tick() {
      const video = videoRef.current
      if (!video) return
      const { start, end } = selectionRef.current
      const t = video.currentTime

      if (t >= end || t < start) {
        video.currentTime = start
      }

      setCurrentTime(video.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return

    if (playing) {
      video.pause()
      setPlaying(false)
    } else {
      // Start from selection start if outside the window.
      const { start, end } = selectionRef.current
      if (video.currentTime < start || video.currentTime >= end) {
        video.currentTime = start
      }
      video.play()
      setPlaying(true)
    }
  }

  // When selection changes while playing, clamp currentTime into the new window.
  function handleSelectionChange(next) {
    setSelection(next)
    const video = videoRef.current
    if (!video) return
    if (video.currentTime < next.start || video.currentTime > next.end) {
      video.currentTime = next.start
    }
  }

  // Stop on unmount / cancel.
  function handleCancel() {
    videoRef.current?.pause()
    onCancel()
  }

  const length = selection.end - selection.start

  return (
    <div className={styles.component_root}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <Icon icon={Scissors} layoutClassName={styles.headerIconLayout} />
          <span className={styles.title}>Trim video</span>
        </div>

        <p className={styles.hint}>
          Select up to {MAX_TRIM_SECONDS}s. Drag the window to move it, drag the
          edges to resize, or play through the selection.
        </p>

        {/* Visible video preview — shows the current frame while scrubbing / playing */}
        <div className={styles.previewWrapper}>
          <video
            playsInline
            ref={videoRef}
            muted={false}
            className={styles.preview}
          />
        </div>

        <Trim
          maxSelection={MAX_TRIM_SECONDS}
          onSelectionChange={handleSelectionChange}
          {...{ duration, selection }}
        >
          <VideoFrameStrip
            height={80}
            playhead={currentTime}
            {...{ file, duration }}
          />
        </Trim>

        <div className={styles.meta}>
          <span className={styles.time}>
            {formatTime(currentTime)} · {formatTime(selection.start)} – {formatTime(selection.end)} · {length.toFixed(1)}s
          </span>
          <ActionIconButton
            icon={playing ? Pause : Play}
            onClick={togglePlay}
            isActive={playing}
            title={playing ? 'Pause' : 'Play selection'}
            style='transparent'
          />
        </div>

        <div className={styles.footer}>
          <Button
            label='Cancel'
            variant='outline'
            onClick={handleCancel}
          />
          <Button
            label='Use this clip'
            onClick={() => { videoRef.current?.pause(); onConfirm(selection.start, selection.end) }}
          />
        </div>
      </div>
    </div>
  )
}
