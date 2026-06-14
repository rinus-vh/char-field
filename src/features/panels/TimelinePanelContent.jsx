import { SettingsKeyframeTimeline } from '@6njp/prototype-library'

import { useVideoTimeline } from '@/features/contexts/VideoTimelineContext.jsx'
import { useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { DEFAULTS } from '@/features/contexts/CharFieldContext.jsx'

export function TimelinePanelContent() {
  const {
    tracks, playhead, playheadRef, playing, loop, fps, duration, recording, selectedKeyframes,
    toggle, pause, setLoop, setRecording, setPlayhead, setTrackMuted, clearAllTracks,
    selectKeyframe, moveSelectedKeyframes, selectKeyframesInBox, clearSelection, setFps,
  } = useVideoTimeline()

  const { resetAll } = useCharField()

  function handleClearAll() {
    clearAllTracks()
    resetAll()
  }

  return (
    <SettingsKeyframeTimeline
      onToggle={toggle}
      onPause={pause}
      onSetLoop={setLoop}
      onSetRecording={setRecording}
      onSetPlayhead={setPlayhead}
      onSetTrackMuted={setTrackMuted}
      onClearAll={handleClearAll}
      onSelectKeyframe={selectKeyframe}
      onMoveSelectedKeyframes={moveSelectedKeyframes}
      onSelectKeyframesInBox={selectKeyframesInBox}
      onClearSelection={clearSelection}
      onSetFps={setFps}
      {...{
        tracks,
        playhead,
        playheadRef,
        playing,
        loop,
        fps,
        duration,
        recording,
        selectedKeyframes
      }}
    />
  )
}
