import { useState } from 'react'
import { CapacityGrid } from './CapacityGrid'
import type { Range } from './dates'
import { RangeControls } from './RangeControls'

const INITIAL_RANGE: Range = { from: '2025-12-29', to: '2026-01-16' }

export function App() {
  const [range, setRange] = useState(INITIAL_RANGE)

  return (
    <main>
      <h1>Team capacity</h1>
      <RangeControls range={range} onChange={setRange} />
      <CapacityGrid range={range} />
    </main>
  )
}
