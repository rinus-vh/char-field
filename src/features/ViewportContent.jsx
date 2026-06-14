import { useEffect, useRef, useState } from 'react'
import { FileUpload } from '@6njp/prototype-library'
import { Video, X, CircleDot } from 'lucide-react'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { CharFieldViewport } from '@/features/CharFieldViewport.jsx'

import styles from './ViewportContent.module.css'

// The viewport panel body: an upload prompt until a source is loaded, then the
// live glyph output. Image upload is the only input today; video and live camera
// will mount their own capture UI here while reusing CharFieldViewport unchanged.
export function ViewportContent() {
  const { source, loadImageFile, loadLiveFeed, isLoading, error } = useCharField()
  const [feedOpen, setFeedOpen] = useState(false)
  const [stream, setStream] = useState(null)
  const [feedError, setFeedError] = useState(null)
  const videoRef = useRef(null)

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
    // Hand stream ownership to the InputSource — don't stop tracks here.
    setStream(null)
    setFeedOpen(false)
  }

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, feedOpen])

  if (!source) {
    return (
      <div className={styles.component}>
        <div className={styles.prompt}>
          <FileUpload
            label={isLoading ? 'Loading…' : 'Drop an image here'}
            accept={['.png', '.jpg', '.jpeg', '.webp', '.gif']}
            onFile={loadImageFile}
            layoutClassName={styles.uploadLayout}
          />

          <button type='button' className={styles.liveFeedButton} onClick={openFeed}>
            <Video size={15} />
            <span>Start live feed</span>
          </button>

          {(error || feedError) && (
            <span className={styles.error}>{error ?? feedError}</span>
          )}
        </div>

        {feedOpen && (
          <div className={styles.overlay}>
            <div className={styles.dialog}>
              <div className={styles.dialogHeader}>
                <span className={styles.dialogTitle}>Live feed preview</span>
                <button type='button' className={styles.closeButton} onClick={closeFeed}>
                  <X size={16} />
                </button>
              </div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.video}
              />
              <div className={styles.dialogFooter}>
                <button type='button' className={styles.startButton} onClick={startFeed}>
                  <CircleDot size={15} />
                  <span>Use live feed</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return <CharFieldViewport />
}
