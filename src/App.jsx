import {
  Grid, Header, Panel,
  MinimizedPanelsMenuContextProvider, MinimizedPanelsMenu, usePanelManager,
} from '@6njp/prototype-library'
import { getThemeVariables, ThemeContextProvider } from '@6njp/prototype-library/machinery'
import { AtSignIcon } from 'lucide-react'

import { ViewportContent } from '@/features/ViewportContent.jsx'
import { SettingsContent } from '@/features/SettingsContent.jsx'
import { ExportPanelContent } from '@/features/panels/ExportPanelContent.jsx'
import { TimelinePanelContent } from '@/features/panels/TimelinePanelContent.jsx'

import { CharFieldContextProvider } from '@/contexts/CharFieldContextProvider.jsx'
import { useCharFieldContext } from '@/contexts/CharFieldContext.jsx'
import { VideoTimelineContextProvider } from '@/contexts/VideoTimelineContextProvider.jsx'
import { useVideoTimelineContext } from '@/contexts/VideoTimelineContext.jsx'
import { VideoPrerenderContextProvider } from '@/contexts/VideoPrerenderContextProvider.jsx'

import styles from './App.module.css'

export default function App() {
  const [isDark, setIsDark] = React.useState(true)
  const theme = isDark ? 'dark' : 'light'

  return (
    <ThemeContextProvider {...{ theme }}>
      <CharFieldContextProvider>
        <VideoTimelineContextProvider>
          <VideoPrerenderContextProvider>
            <MinimizedPanelsMenuContextProvider>
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
            </MinimizedPanelsMenuContextProvider>
          </VideoPrerenderContextProvider>
        </VideoTimelineContextProvider>
      </CharFieldContextProvider>
    </ThemeContextProvider>
  )
}

function AppPanels() {
  const { isVideo }              = useVideoTimelineContext()
  const { settings: appSettings } = useCharFieldContext()

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
