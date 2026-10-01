import {
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { addDays, rangeError, type Range } from './dates'

type Props = {
  range: Range
  onChange: Dispatch<SetStateAction<Range>>
}

export function RangeControls({ range, onChange }: Props) {
  const [draft, setDraft] = useState(range)
  const [shown, setShown] = useState(range)
  const [error, setError] = useState<string | null>(null)

  // Keep the inputs in step with the range when it changes from outside the form.
  if (range !== shown) {
    setShown(range)
    setDraft(range)
  }

  function shift(days: number) {
    setError(null)
    onChange((r) => ({ from: addDays(r.from, days), to: addDays(r.to, days) }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = rangeError(draft.from, draft.to)
    setError(problem)
    // A new object even for unchanged dates, so Show also reloads the range.
    if (!problem) onChange({ ...draft })
  }

  return (
    <form className="range-controls" onSubmit={submit}>
      <button type="button" onClick={() => shift(-7)}>
        <span aria-hidden="true">←</span> Previous week
      </button>
      <button type="button" onClick={() => shift(7)}>
        Next week <span aria-hidden="true">→</span>
      </button>
      <label>
        From
        <input
          type="date"
          name="from"
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          name="to"
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
      </label>
      <button type="submit">Show</button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
