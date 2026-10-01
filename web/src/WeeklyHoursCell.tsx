import { useEffect, useRef, type FormEvent } from 'react'
import type { Person } from './api'
import { formatHours } from './format'
import { CheckIcon, CloseIcon, PencilIcon } from './ui/icons'
import { MAX_WEEKLY_HOURS, type Edit } from './useWeeklyHoursEdits'

type Props = {
  person: Person
  edit: Edit | undefined
  onOpen: () => void
  onChange: (draft: string) => void
  onCancel: () => void
  onSave: () => void
}

// WeeklyHoursCell shows a person's weekly hours, or the open edit for them. The
// edit itself lives in useWeeklyHoursEdits, so it outlives this cell.
export function WeeklyHoursCell({
  person,
  edit,
  onOpen,
  onChange,
  onCancel,
  onSave,
}: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const returnFocus = useRef(false)
  const editing = edit !== undefined

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false
      button.current?.focus()
    }
  }, [editing])

  // The Save button is replaced while saving, so bring focus back to the value.
  useEffect(() => {
    if (edit?.error) input.current?.focus()
  }, [edit?.error])

  function cancel() {
    returnFocus.current = true
    onCancel()
  }

  function save(event: FormEvent) {
    event.preventDefault()
    returnFocus.current = true
    onSave()
  }

  if (!edit) {
    return (
      <td className="capacity">
        <button
          ref={button}
          type="button"
          className="hours-button"
          aria-label={`Edit weekly hours for ${person.name}`}
          onClick={onOpen}
        >
          {formatHours(person.weekly_hours)} h
          <PencilIcon />
        </button>
      </td>
    )
  }

  return (
    <td className="capacity">
      <form
        className="hours-form"
        onSubmit={save}
        onKeyDown={(e) => e.key === 'Escape' && !edit.saving && cancel()}
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
          dir="ltr"
          value={edit.draft}
          readOnly={edit.saving}
          autoFocus
          aria-label={`Weekly hours for ${person.name}`}
          onChange={(e) => onChange(e.target.value)}
        />
        {edit.saving ? (
          <span role="status">Saving…</span>
        ) : (
          <>
            <button
              type="submit"
              className="icon-button save"
              aria-label="Save"
            >
              <CheckIcon />
            </button>
            <button
              type="button"
              className="icon-button cancel"
              aria-label="Cancel"
              onClick={cancel}
            >
              <CloseIcon />
            </button>
          </>
        )}
      </form>
      {edit.error && (
        <p className="save-error" role="alert">
          {edit.error}
        </p>
      )}
    </td>
  )
}
