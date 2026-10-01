export type PersonCapacity = {
  id: number
  name: string
  weekly_hours: number
  // allocated[i] is the hours allocated in weeks[i].
  allocated: number[]
}

export type CapacityResponse = {
  from: string
  to: string
  weeks: string[]
  people: PersonCapacity[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type Person = {
  id: number
  name: string
  weekly_hours: number
}

const TIMEOUT_MS = 15_000

// request resolves with the JSON body, or rejects with an ApiError whose message
// can be shown as-is. Status 0 means no response arrived. Caller aborts are
// rethrown untouched so callers can ignore them.
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout

  let res: Response
  try {
    res = await fetch(url, { ...init, signal })
  } catch (err) {
    if (init.signal?.aborted) throw err
    if (timeout.aborted) {
      throw new ApiError("The server didn't respond in time.", 0)
    }
    throw new ApiError("The server couldn't be reached.", 0)
  }

  if (res.status >= 500) {
    throw new ApiError('The server had a problem.', res.status)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body?.error ?? `The request failed (${res.status}).`
    throw new ApiError(message, res.status)
  }
  return body as T
}

export function fetchCapacity(from: string, to: string, signal?: AbortSignal) {
  return request<CapacityResponse>(
    `/api/capacity?${new URLSearchParams({ from, to })}`,
    { signal },
  )
}

export function updateWeeklyHours(id: number, weeklyHours: number) {
  return request<Person>(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekly_hours: weeklyHours }),
  })
}
