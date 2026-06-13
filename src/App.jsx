import { Grid, Header, MinimizedPanelsMenu, MinimizedPanelsProvider, Panel, usePanelManager } from '@6njp/prototype-library'
import { getThemeVariables } from '@6njp/prototype-library/machinery'

import { ControlsOverview } from '@/pages/ControlsOverview/ControlsOverview.jsx'
import { DesignOverview } from '@/pages/DesignOverview/DesignOverview.jsx'

import styles from './App.module.css'

export default function App() {
  const [isDark, setIsDark] = React.useState(true)
  const themeName = isDark ? 'dark' : 'light'
  const themeVariables = getThemeVariables(themeName)

  return (
    <MinimizedPanelsProvider>
      <main style={themeVariables} className={styles.app}>
        <Header onToggleTheme={() => setIsDark(d => !d)} layoutClassName={styles.headerLayout} {...{ isDark }} />

        <Grid layoutClassName={styles.gridLayout}>
          <AppPanels />
        </Grid>

        <MinimizedPanelsMenu layoutClassName={styles.minimizedMenuLayout} />
      </main>
    </MinimizedPanelsProvider>
  )
}

function AppPanels() {
  const design   = usePanelManager('design',    'Design')
  const controls = usePanelManager('controls',  'Controls')
  const prototype = usePanelManager('prototype', 'Prototype')

  return (
    <>
      {design.visible && (
        <Panel title='Design' minWidth={8} minHeight={8} minimizable onMinimize={design.minimize}>
          <DesignOverview />
        </Panel>
      )}

      {controls.visible && (
        <Panel title='Controls' minWidth={8} minHeight={8} minimizable onMinimize={controls.minimize}>
          <ControlsOverview />
        </Panel>
      )}

      {prototype.visible && (
        <Panel title='Prototype' minWidth={6} minHeight={7} minimizable onMinimize={prototype.minimize} />
      )}
    </>
  )
}
