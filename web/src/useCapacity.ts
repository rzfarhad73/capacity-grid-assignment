import { useEffect, useState } from 'react'
import { fetchCapacity, type CapacityResponse } from './api'
import type { Range } from './dates'

type State = {
  data: CapacityResponse | null
  loading: boolean
  error: string | null
}

// useCapacity loads the range, and loads again whenever it gets a new range
// object. The previous data is kept, so a failed load can fall back to it; a
// superseded request is aborted.
export function useCapacity(range: Range) {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchCapacity(range.from, range.to, controller.signal).then(
      (data) => setState({ data, loading: false, error: null }),
      (err: Error) => {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, loading: false, error: err.message }))
      },
    )
    return () => controller.abort()
  }, [range, attempt])

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
