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
import { Skeleton } from './ui/Skeleton'
import { useCapacity } from './useCapacity'

type Props = {
  range: Range
}

const hours = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

// CapacityGrid shows allocated hours per person per week against their weekly
// capacity. Over-allocated weeks are marked in colour and with the excess hours.
export function CapacityGrid({ range }: Props) {
  const { data, loading, error, retry } = useCapacity(range)
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
                <PersonRow key={person.id} person={person} />
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

function PersonRow({ person }: { person: PersonCapacity }) {
  return (
    <tr>
      <th scope="row" dir="auto">
        {person.name}
      </th>
      <td className="capacity">{hours.format(person.weekly_hours)} h</td>
      {person.allocated.map((allocated, i) => (
        <AllocationCell
          key={i}
          allocated={allocated}
          capacity={person.weekly_hours}
        />
      ))}
    </tr>
  )
}

type CellProps = {
  allocated: number
  capacity: number
}

function AllocationCell({ allocated, capacity }: CellProps) {
  const excess = allocated - capacity
  if (excess > 0) {
    const title = `${hours.format(allocated)} h allocated, ${hours.format(capacity)} h capacity`
    return (
      <td className="over" title={title}>
        {hours.format(allocated)}{' '}
        <span className="excess">+{hours.format(excess)}</span>
      </td>
    )
  }
  return (
    <td className={allocated === 0 ? 'idle' : undefined}>
      {hours.format(allocated)}
    </td>
  )
}
