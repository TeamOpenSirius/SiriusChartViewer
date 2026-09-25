// Library entry: `import { SiriusChartViewer } from 'sirius-chart-viewer'`
// plus `import 'sirius-chart-viewer/style.css'`. Serve the package's `assets/`
// directory and pass its URL as the `asset-base` prop.
export { default as SiriusChartViewer } from './components/SiriusChartViewer.vue'
export { ChartViewer, readSource } from './lib/viewer'
export type { ChartInfo, ChartInput, ChartSource, DisplaySettings, ViewerOptions } from './lib/viewer'
export type { Settings } from './lib/settings'
