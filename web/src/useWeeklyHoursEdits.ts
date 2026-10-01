import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, updateWeeklyHours, type Person } from './api'

export const MAX_WEEKLY_HOURS = 168

export type Edit = {
  draft: string
  saving: boolean
  error: string | null
}

export type EditActions = {
  open: (person: Person) => void
  change: (id: number, draft: string) => void
  cancel: (id: number) => void
  save: (person: Person) => Promise<void>
}

// useWeeklyHoursEdits holds every open weekly-hours edit, keyed by person, at
// grid level rather than in the row, so a typed value, a save in flight or its
// error survives the row being unmounted, e.g. while another range loads.
//
// The actions never change identity, so rows can be memoised and a keystroke
// re-renders only the row being edited.
export function useWeeklyHoursEdits(onSaved: (person: Person) => void) {
  const [edits, setEdits] = useState<Record<number, Edit>>({})
  const latest = useRef(edits)
  useEffect(() => {
    latest.current = edits
  }, [edits])

  const actions = useMemo<EditActions>(() => {
    function update(id: number, patch: Partial<Edit>) {
      setEdits((all) =>
        all[id] ? { ...all, [id]: { ...all[id], ...patch } } : all,
      )
    }

    function close(id: number) {
      setEdits((all) => {
        const rest = { ...all }
        delete rest[id]
        return rest
      })
    }

    return {
      open: (person) =>
        setEdits((all) => ({
          ...all,
          [person.id]: {
            draft: String(person.weekly_hours),
            saving: false,
            error: null,
          },
        })),
      change: (id, draft) => update(id, { draft }),
      cancel: close,
      async save(person) {
        const edit = latest.current[person.id]
        if (!edit || edit.saving) return

        const value = Number(edit.draft)
        if (
          edit.draft.trim() === '' ||
          !(value >= 0 && value <= MAX_WEEKLY_HOURS)
        ) {
          update(person.id, {
            error: `Enter hours between 0 and ${MAX_WEEKLY_HOURS}.`,
          })
          return
        }
        if (value === person.weekly_hours) return close(person.id)

        update(person.id, { saving: true, error: null })
        try {
          onSaved(await updateWeeklyHours(person.id, value))
          close(person.id)
        } catch (err) {
          update(person.id, { saving: false, error: saveErrorMessage(err) })
        }
      },
    }
  }, [onSaved])

  return { edits, actions }
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
