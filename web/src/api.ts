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

// request resolves with the JSON body, or rejects with an ApiError whose message
// can be shown as-is. Aborts are rethrown untouched so callers can ignore them.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (init?.signal?.aborted) throw err
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
