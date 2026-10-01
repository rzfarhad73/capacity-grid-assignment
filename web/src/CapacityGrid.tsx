import { memo } from 'react'
import type { PersonCapacity } from './api'
import {
  addDays,
  formatDate,
  formatRange,
  formatWeek,
  mondayOf,
  weekCount,
  type Range,
} from './dates'
import { formatHours } from './format'
import { Skeleton } from './ui/Skeleton'
import { useCapacity } from './useCapacity'
import {
  useWeeklyHoursEdits,
  type Edit,
  type EditActions,
} from './useWeeklyHoursEdits'
import { WeeklyHoursCell } from './WeeklyHoursCell'

type Props = {
  range: Range
}

// CapacityGrid shows allocated hours per person per week against their weekly
// capacity. Over-allocated weeks are marked in colour and with the excess hours.
export function CapacityGrid({ range }: Props) {
  const { data, loading, error, retry, confirmSave } = useCapacity(range)
  const { edits, actions } = useWeeklyHoursEdits(confirmSave)
  const { from, to } = range
  const requested = formatRange(mondayOf(from), addDays(mondayOf(to), 6))
  const loadError = error && (
    <div className="load-error" role="alert">
      <strong>{requested} didn't load.</strong> {error}{' '}
      {data && <>Still showing {formatRange(data.from, data.to)}. </>}
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  )

  if (loading) return <GridSkeleton range={range} />
  if (!data) return loadError

  return (
    <section>
      <p className="range">{formatRange(data.from, data.to)}</p>
      <p className="legend">
        <span className="over-swatch" aria-hidden="true" /> Over capacity, with
        the extra hours. Select a capacity to change it.
      </p>
      {loadError}

      {data.people.length === 0 ? (
        <p>No people to show.</p>
      ) : (
        <div className="grid">
          <table>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col" className="capacity">
                  Capacity
                </th>
                {data.weeks.map((week) => (
                  <th
                    key={week}
                    scope="col"
                    title={`Week of ${formatDate(week)}`}
                  >
                    {formatWeek(week)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.people.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  edit={edits[person.id]}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const SKELETON_ROWS = 20

// GridSkeleton holds the grid's shape while a range loads, with its real week headers.
function GridSkeleton({ range: { from, to } }: Props) {
  const first = mondayOf(from)
  const weeks = Array.from({ length: weekCount(from, to) }, (_, i) =>
    addDays(first, 7 * i),
  )

  return (
    <section role="status" aria-label="Loading capacity">
      <p className="range">
        <Skeleton width="14rem" />
      </p>
      <div className="grid">
        <table>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col" className="capacity">
                Capacity
              </th>
              {weeks.map((week) => (
                <th key={week} scope="col">
                  {formatWeek(week)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <tr key={row}>
                <th scope="row">
                  <Skeleton width={`${8 + (row % 4)}rem`} />
                </th>
                <td className="capacity">
                  <Skeleton width="2.5rem" />
                </td>
                {weeks.map((week) => (
                  <td key={week}>
                    <Skeleton width="1.5rem" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type RowProps = {
  person: PersonCapacity
  edit: Edit | undefined
  actions: EditActions
}

// Memoised: while one person is edited, only their row re-renders on each keystroke.
const PersonRow = memo(function PersonRow({ person, edit, actions }: RowProps) {
  return (
    <tr>
      <th scope="row" dir="auto" title={person.name}>
        {person.name}
      </th>
      <WeeklyHoursCell
        person={person}
        edit={edit}
        onOpen={() => actions.open(person)}
        onChange={(draft) => actions.change(person.id, draft)}
        onCancel={() => actions.cancel(person.id)}
        onSave={() => actions.save(person)}
      />
      {person.allocated.map((allocated, i) => (
        <AllocationCell
          key={i}
          allocated={allocated}
          capacity={person.weekly_hours}
        />
      ))}
    </tr>
  )
})

type CellProps = {
  allocated: number
  capacity: number
}

function AllocationCell({ allocated, capacity }: CellProps) {
  const excess = allocated - capacity
  if (excess > 0) {
    const title = `${formatHours(allocated)} h allocated, ${formatHours(capacity)} h capacity`
    return (
      <td className="over" title={title}>
        {formatHours(allocated)}{' '}
        <span className="excess">+{formatHours(excess)}</span>
      </td>
    )
  }
  return (
    <td className={allocated === 0 ? 'idle' : undefined}>
      {formatHours(allocated)}
    </td>
  )
}
