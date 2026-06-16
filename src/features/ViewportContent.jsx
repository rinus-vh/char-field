import { useState } from 'react'
import { FileUpload, GhostButton, Modal } from '@6njp/prototype-library'
import { Video, CircleDot } from 'lucide-react'

import { CharFieldViewport } from '@/features/CharFieldViewport.jsx'
import { VideoTrimModal } from '@/features/VideoTrimModal.jsx'

import { useCharFieldContext } from '@/contexts/CharFieldContext.jsx'

import styles from './ViewportContent.module.css'

const IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const VIDEO_FORMATS = ['.mp4', '.webm', '.mov', '.avi']
const ALL_FORMATS   = [...IMAGE_FORMATS, ...VIDEO_FORMATS]

function isVideoFile(file) {
  if (file.type.startsWith('video/')) return true
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  return VIDEO_FORMATS.includes(ext)
}

export function ViewportContent() {
  const { source, loadImageFile, loadVideoFile, loadLiveFeed, isLoading, error } = useCharFieldContext()

  // ── Live feed state ────────────────────────────────────────────────────────
  const [feedOpen,  setFeedOpen]  = useState(false)
  const [stream,    setStream]    = useState(null)
  const [feedError, setFeedError] = useState(null)
  function videoRef(el) {
    if (el && stream) el.srcObject = stream
  }

  // ── Video trim state ───────────────────────────────────────────────────────
  const [pendingVideo,   setPendingVideo]  = useState(null) // { file, duration }
  const [videoLoadError, setVideoLoadError] = useState(null)

  // ── Unified file handler — routes to image or video pipeline ──────────────
  async function handleFile(file) {
    setVideoLoadError(null)
    if (isVideoFile(file)) {
      try {
        const video = document.createElement('video')
        const url   = URL.createObjectURL(file)
        video.src     = url
        video.preload = 'metadata'
        await new Promise((resolve, reject) => {
          video.addEventListener('loadedmetadata', resolve, { once: true })
          video.addEventListener('error', reject,           { once: true })
        })
        URL.revokeObjectURL(url)
        setPendingVideo({ file, duration: video.duration })
      } catch {
        setVideoLoadError('Could not read video file')
      }
    } else {
      loadImageFile(file)
    }
  }

  function handleTrimConfirm(trimStart, trimEnd) {
    loadVideoFile(pendingVideo.file, trimStart, trimEnd)
    setPendingVideo(null)
  }

  // ── Live feed handlers ─────────────────────────────────────────────────────
  async function openFeed() {
    setFeedError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setStream(s)
      setFeedOpen(true)
    } catch {
      setFeedError('Camera access denied')
    }
  }

  function closeFeed() {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    setFeedOpen(false)
    setFeedError(null)
  }

  async function startFeed() {
    if (!stream) return
    await loadLiveFeed(stream)
    setStream(null)
    setFeedOpen(false)
  }


  if (!source) {
    const anyError = error ?? feedError ?? videoLoadError

    return (
      <div className={styles.component}>
        <div className={styles.prompt}>
          <FileUpload
            displayAcceptedFormats
            label={isLoading ? 'Loading…' : 'Drop a photo or video here'}
            accept={ALL_FORMATS}
            onFile={handleFile}
            layoutClassName={styles.uploadLayout}
          />

          <GhostButton
            label='Start live feed'
            icon={Video}
            color='white'
            onClick={openFeed}
            layoutClassName={styles.liveFeedButtonLayout}
          />

          {anyError && <span className={styles.error}>{anyError}</span>}
        </div>

        <Modal isOpen={feedOpen} onClose={closeFeed} title='Live feed preview'>
          <div className={styles.feedModalContent}>
            <video
              autoPlay
              playsInline
              muted
              ref={videoRef}
              className={styles.video}
            />
            <GhostButton
              label='Use live feed'
              icon={CircleDot}
              color='dynamic'
              onClick={startFeed}
              layoutClassName={styles.startButtonLayout}
            />
          </div>
        </Modal>

        {pendingVideo && (
          <VideoTrimModal
            file={pendingVideo.file}
            duration={pendingVideo.duration}
            onConfirm={handleTrimConfirm}
            onCancel={() => setPendingVideo(null)}
          />
        )}
      </div>
    )
  }

  return <CharFieldViewport />
}
