import {
  Grid, Header, Panel,
  MinimizedPanelsProvider, MinimizedPanelsMenu, usePanelManager,
} from '@6njp/prototype-library'
import { getThemeVariables, ThemeProvider } from '@6njp/prototype-library/machinery'
import { AtSignIcon } from 'lucide-react'

import { CharFieldProvider, useCharField } from '@/features/contexts/CharFieldContext.jsx'
import { VideoTimelineProvider, useVideoTimeline } from '@/features/contexts/VideoTimelineContext.jsx'
import { VideoPrerenderProvider } from '@/features/contexts/VideoPrerenderContext.jsx'
import { ViewportContent } from '@/features/ViewportContent.jsx'
import { SettingsContent } from '@/features/SettingsContent.jsx'
import { ExportPanelContent } from '@/features/panels/ExportPanelContent.jsx'
import { TimelinePanelContent } from '@/features/panels/TimelinePanelContent.jsx'

import styles from './App.module.css'

export default function App() {
  const [isDark, setIsDark] = React.useState(true)
  const theme = isDark ? 'dark' : 'light'

  return (
    <ThemeProvider {...{ theme }}>
      <CharFieldProvider>
        <VideoTimelineProvider>
          <VideoPrerenderProvider>
            <MinimizedPanelsProvider>
              <main style={getThemeVariables(theme)} className={styles.app}>
                <Header
                  title='Char-field'
                  logo={AtSignIcon}
                  onToggleTheme={() => setIsDark(prev => !prev)}
                  layoutClassName={styles.headerLayout}
                  {...{ isDark }}
                />

                <Grid layoutClassName={styles.gridLayout}>
                  <AppPanels />
                </Grid>

                <MinimizedPanelsMenu layoutClassName={styles.minimizedMenuLayout} />
              </main>
            </MinimizedPanelsProvider>
          </VideoPrerenderProvider>
        </VideoTimelineProvider>
      </CharFieldProvider>
    </ThemeProvider>
  )
}

function AppPanels() {
  const { isVideo }              = useVideoTimeline()
  const { settings: appSettings } = useCharField()

  const viewportTitle = appSettings.showRawInput ? 'Input' : 'Viewport'
  const viewport  = usePanelManager('viewport',  viewportTitle)
  const settings  = usePanelManager('settings',  'Settings')
  const exportPanel = usePanelManager('export',  'Export',   { defaultVisible: false })
  const timeline  = usePanelManager('timeline',  'Timeline')

  return (
    <>
      {settings.visible && (
        <Panel
          isMinimizable
          title='Settings'
          minWidth={4}
          minHeight={9}
          onMinimize={settings.minimize}
        >
          <SettingsContent onOpenExport={exportPanel.open} />
        </Panel>
      )}

      {viewport.visible && (
        <Panel
          isMinimizable
          title='Viewport'
          minWidth={8}
          minHeight={6}
          onMinimize={viewport.minimize}
        >
          <ViewportContent />
        </Panel>
      )}

      {exportPanel.visible && (
        <Panel
          isCloseable
          isMinimizable
          title='Export'
          minWidth={4}
          minHeight={4}
          onClose={exportPanel.close}
          onMinimize={exportPanel.minimize}
        >
          <ExportPanelContent />
        </Panel>
      )}

      {isVideo && timeline.visible && (
        <Panel
          isMinimizable
          title='Timeline'
          minWidth={8}
          minHeight={3}
          onMinimize={timeline.minimize}
        >
          <TimelinePanelContent />
        </Panel>
      )}
    </>
  )
}
