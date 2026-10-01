import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCapacity, type CapacityResponse, type Person } from './api'
import type { Range } from './dates'

type State = {
  data: CapacityResponse | null
  loading: boolean
  error: string | null
}

type Saved = { weeklyHours: number; at: number }

// useCapacity loads the range, and loads again whenever it gets a new range
// object. The previous data is kept, so a failed load can fall back to it; a
// superseded request is aborted.
//
// confirmSave applies a saved person to the loaded data. A load that started
// before the save may have read the old value, so saves confirmed after a load
// started are re-applied to its response.
export function useCapacity(range: Range) {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)
  const clock = useRef(0)
  const saved = useRef(new Map<number, Saved>())

  useEffect(() => {
    const controller = new AbortController()
    const startedAt = ++clock.current
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchCapacity(range.from, range.to, controller.signal).then(
      (data) => {
        const people = data.people.map((p) => {
          const save = saved.current.get(p.id)
          return save && save.at > startedAt
            ? { ...p, weekly_hours: save.weeklyHours }
            : p
        })
        setState({ data: { ...data, people }, loading: false, error: null })
      },
      (err: Error) => {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, loading: false, error: err.message }))
      },
    )
    return () => controller.abort()
  }, [range, attempt])

  const confirmSave = useCallback((person: Person) => {
    saved.current.set(person.id, {
      weeklyHours: person.weekly_hours,
      at: ++clock.current,
    })
    setState((s) => {
      if (!s.data) return s
      const people = s.data.people.map((p) =>
        p.id === person.id ? { ...p, weekly_hours: person.weekly_hours } : p,
      )
      return { ...s, data: { ...s.data, people } }
    })
  }, [])

  return { ...state, retry: () => setAttempt((n) => n + 1), confirmSave }
}
