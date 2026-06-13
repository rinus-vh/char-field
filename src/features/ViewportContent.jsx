import { FileUpload } from '@6njp/prototype-library'

import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { CharFieldViewport } from '@/features/CharFieldViewport.jsx'

import styles from './ViewportContent.module.css'

// The viewport panel body: an upload prompt until a source is loaded, then the
// live glyph output. Image upload is the only input today; video and live camera
// will mount their own capture UI here while reusing CharFieldViewport unchanged.
export function ViewportContent() {
  const { source, loadImageFile, isLoading, error } = useCharField()

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
          {error && <span className={styles.error}>{error}</span>}
        </div>
      </div>
    )
  }

  return <CharFieldViewport />
}
