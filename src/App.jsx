import { Type } from 'lucide-react'
import {
  Grid, Header, Panel,
  MinimizedPanelsProvider, MinimizedPanelsMenu, usePanelManager,
} from '@6njp/prototype-library'
import { getThemeVariables, ThemeProvider } from '@6njp/prototype-library/machinery'

import { CharFieldProvider } from '@/features/contexts/CharFieldContext.jsx'
import { ViewportContent } from '@/features/ViewportContent.jsx'
import { SettingsContent } from '@/features/SettingsContent.jsx'
import { ExportPanelContent } from '@/features/panels/ExportPanelContent.jsx'

import styles from './App.module.css'

export default function App() {
  const [isDark, setIsDark] = React.useState(true)
  const theme = isDark ? 'dark' : 'light'

  return (
    <ThemeProvider {...{ theme }}>
      <CharFieldProvider>
        <MinimizedPanelsProvider>
          <main style={getThemeVariables(theme)} className={styles.app}>
            <Header
              title='Char Field'
              logo={Type}
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
      </CharFieldProvider>
    </ThemeProvider>
  )
}

function AppPanels() {
  const viewport = usePanelManager('viewport', 'Viewport')
  const settings = usePanelManager('settings', 'Settings')
  const exportPanel = usePanelManager('export', 'Export', { defaultVisible: false })

  return (
    <>
      {settings.visible && (
        <Panel
          minimizable
          title='Settings'
          minWidth={5}
          minHeight={10}
          onMinimize={settings.minimize}
        >
          <SettingsContent onOpenExport={exportPanel.open} />
        </Panel>
      )}

      {viewport.visible && (
        <Panel
          minimizable
          title='Viewport'
          minWidth={7}
          minHeight={10}
          onMinimize={viewport.minimize}
        >
          <ViewportContent />
        </Panel>
      )}

      {exportPanel.visible && (
        <Panel
          closeable
          minimizable
          title='Export'
          minWidth={4}
          minHeight={6}
          onClose={exportPanel.close}
          onMinimize={exportPanel.minimize}
        >
          <ExportPanelContent />
        </Panel>
      )}
    </>
  )
}
