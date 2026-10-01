import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, updateWeeklyHours, type Person } from './api'
import { formatHours } from './format'

const MAX_WEEKLY_HOURS = 168

type Props = {
  person: Person
  onSaved: (person: Person) => void
}

// WeeklyHoursCell shows a person's weekly hours and edits them in place. It
// waits for the server before closing, so the grid only shows saved values.
export function WeeklyHoursCell({ person, onSaved }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (draft === null && returnFocus.current) {
      returnFocus.current = false
      button.current?.focus()
    }
  }, [draft])

  // The Save button is replaced while saving, so bring focus back to the value.
  useEffect(() => {
    if (error) input.current?.focus()
  }, [error])

  function close() {
    returnFocus.current = true
    setDraft(null)
    setError(null)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (draft === null || saving) return

    const value = Number(draft)
    if (draft.trim() === '' || !(value >= 0 && value <= MAX_WEEKLY_HOURS)) {
      setError(`Enter hours between 0 and ${MAX_WEEKLY_HOURS}.`)
      return
    }
    if (value === person.weekly_hours) return close()

    setSaving(true)
    setError(null)
    try {
      onSaved(await updateWeeklyHours(person.id, value))
      close()
    } catch (err) {
      setError(saveErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (draft === null) {
    return (
      <td className="capacity">
        <button
          ref={button}
          type="button"
          className="hours-button"
          aria-label={`Edit weekly hours for ${person.name}`}
          onClick={() => setDraft(String(person.weekly_hours))}
        >
          {formatHours(person.weekly_hours)} h
        </button>
      </td>
    )
  }

  return (
    <td className="capacity">
      <form
        className="hours-form"
        onSubmit={save}
        onKeyDown={(e) => e.key === 'Escape' && !saving && close()}
        noValidate
      >
        <input
          ref={input}
          type="number"
          name="weekly_hours"
          min={0}
          max={MAX_WEEKLY_HOURS}
          step="any"
          autoComplete="off"
          value={draft}
          readOnly={saving}
          autoFocus
          aria-label={`Weekly hours for ${person.name}`}
          onChange={(e) => setDraft(e.target.value)}
        />
        {saving ? (
          <span role="status">Saving…</span>
        ) : (
          <>
            <button type="submit">Save</button>
            <button type="button" aria-label="Cancel" onClick={close}>
              ✕
            </button>
          </>
        )}
      </form>
      {error && (
        <p className="save-error" role="alert">
          {error}
        </p>
      )}
    </td>
  )
}

// A 4xx means the server refused the change. Anything else means no answer
// arrived, so the change may or may not have been stored; saving again is safe
// because setting the same hours twice has the same result.
function saveErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    return `Not saved: ${err.message}`
  }
  const reason = err instanceof Error ? err.message : 'Something went wrong.'
  return `${reason} The change may not have been saved; try again.`
}
