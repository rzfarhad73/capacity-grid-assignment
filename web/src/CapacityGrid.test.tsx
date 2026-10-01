import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CapacityResponse, Person } from './api'
import { CapacityGrid } from './CapacityGrid'

const RANGE = { from: '2026-01-05', to: '2026-01-11' }

function capacity(weeklyHours: number): CapacityResponse {
  return {
    from: '2026-01-05',
    to: '2026-01-11',
    weeks: ['2026-01-05'],
    people: [
      { id: 4, name: 'Dee Okafor', weekly_hours: weeklyHours, allocated: [45] },
    ],
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

// Routes fetch calls: each GET and PATCH takes the next queued response.
function stubServer(gets: Promise<Response>[], patches: Promise<Response>[]) {
  const fetch = vi.fn((_url: string, init?: RequestInit) =>
    (init?.method === 'PATCH' ? patches : gets).shift()!,
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function editWeeklyHours(value: string) {
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Edit weekly hours for Dee Okafor',
    }),
  )
  fireEvent.change(screen.getByLabelText('Weekly hours for Dee Okafor'), {
    target: { value },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

const overCell = () => document.querySelector('td.over')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('editing weekly hours', () => {
  it('keeps the typed value and the stored numbers when a save fails', async () => {
    stubServer(
      [Promise.resolve(json(capacity(40)))],
      [Promise.resolve(new Response('', { status: 500 }))],
    )
    render(<CapacityGrid range={RANGE} />)

    await editWeeklyHours('50')

    expect((await screen.findByRole('alert')).textContent).toContain(
      'may not have been saved',
    )
    const input = screen.getByLabelText<HTMLInputElement>(
      'Weekly hours for Dee Okafor',
    )
    expect(input.value).toBe('50')
    expect(overCell()?.textContent).toBe('45 +5')
  })

  it("doesn't let a load that started before a save bring back the old value", async () => {
    const reload = deferred<Response>()
    const patch = deferred<Response>()
    stubServer(
      [Promise.resolve(json(capacity(40))), reload.promise],
      [patch.promise],
    )
    const { rerender } = render(<CapacityGrid range={RANGE} />)

    await editWeeklyHours('50')
    // Reload the same range while the save is in flight; its response was
    // read before the save committed, so it still says 40.
    rerender(<CapacityGrid range={{ ...RANGE }} />)

    const saved: Person = { id: 4, name: 'Dee Okafor', weekly_hours: 50 }
    await act(async () => patch.resolve(json(saved)))
    await act(async () => reload.resolve(json(capacity(40))))

    expect(
      (
        await screen.findByRole('button', {
          name: 'Edit weekly hours for Dee Okafor',
        })
      ).textContent,
    ).toBe('50 h')
    expect(overCell()).toBeNull()
  })
})
