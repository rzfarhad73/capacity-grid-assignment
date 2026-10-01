# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

## Data, before writing code

- `hours_per_day` is 0.125–1.0, but each assignment is 15 rows that sum to 2/4/6/8 h/day.
  They look like duplicates and aren't: sum them, don't dedupe (dedupe gives 0.5–2 h/day).
- Many assignments end on a weekend; Ana's runs Mon–Sun. Allocation counts Mon–Fri only,
  otherwise she shows 56 h in a 40 h week. No holiday data, so Christmas week is a normal week.
- People 1–5 look planted: Ana (Mon–Sun), Bo (Fri–Mon, crosses a week), Cem (one day),
  Dee (overlapping projects, 45 h vs 40), Eli (0 weekly hours, 20 h allocated → no % possible).
- Data is otherwise clean: 500 people, Jun 2025–Jan 2027, no orphans or inverted ranges.
- `weekly_hours` has no effective date, so an edit changes every week, past ones included.

## GET /api/capacity

- Response: `weeks[]` (Mondays) plus `people[]`, each with `weekly_hours` and a dense
  `allocated[]` aligned to `weeks`. Capacity is sent once because it can't vary by week.
- Range widened to whole Mon–Sun weeks and capped at 26 per request (400 above that).
  500 people × 26 weeks: ~45 ms, ~64 KB.
- Weeks are computed once in Go and passed as `date[]`, so Go and SQL can't disagree on columns.
- Checked against hand-written SQL: Ana 40/0/30, Dee 45 vs 40, Eli 20 vs 0.
- Deferred: the `(start_date, end_date)` btree only helps half of the overlap test; at scale
  I'd add a GiST index on `daterange(start_date, end_date)`. Schema is fixed input.

## PATCH /api/people/{id}

- Body `{"weekly_hours": n}`, 0–168; 0 is valid (Eli). Returns the stored person, which is all
  the grid needs: capacity doesn't change allocation, so no range refetch.
- Last write wins; there's no version column to detect concurrent edits.

## Grid

- Plain React, no new dependencies. Over-allocated cells are red and show the excess (`+5`),
  so it doesn't rely on colour alone. Exactly at capacity (Ana 40/40) is not over.
- Range: previous/next week shifts both ends by 7 days; From/To applies on Show, validated
  against the same 26-week cap so an oversized range is explained, not sent. Show reloads
  even when the dates are unchanged, so it doubles as refresh.
- While a range loads, the table shows a skeleton with that range's week headers; a
  superseded request is aborted. A failed load names the range that failed and falls back
  to the last loaded grid with Try again.
- Deferred: row virtualisation. 500 rows render fine; a few thousand × 26 weeks would need it.
  Measured 500 × 26 weeks (13.5k cells): API ~50 ms, click to painted grid 0.5–1.2 s in dev,
  so rendering, not the query, is what grows with the roster.

## Editing weekly hours

- Edited in place in the capacity cell; Enter/Save saves, Escape/✕ cancels. The save waits for
  the server (row shows Saving…), so the grid never shows a value that wasn't stored.
- After a save the person is patched into the loaded data from the PATCH response; every week's
  over/under recomputes from it, with no range refetch. A load that started before the save
  may carry the old value, so saves confirmed after a load started are re-applied to it.
- Failed save keeps the typed value and the editor open. A 4xx says it wasn't saved and why;
  a timeout, network error or 5xx says it may not have been saved. Retrying is safe: setting
  the same hours twice has the same result. Requests time out after 15 s.
- Deferred: a save that fails after the manager has moved to another range has no row to
  report on; the grid shows the stored value when that range loads again. Likewise, moving
  to another range with an editor open drops the unsaved value without warning.

## Tests

- API: `docker compose exec api go test ./...`. The allocation query runs against Postgres with
  its own people and assignments inside a rolled-back transaction, one case per rule (split rows,
  weekends, week boundaries, overlaps, clipping, no assignments). Checked each case fails when
  its rule is broken. Input validation, injection attempts and database errors are covered
  without a database; 500s must not leak the driver's message.
- Web: `docker compose exec web npm test`. A failed save keeps the typed value, and a load
  that started before a save can't bring back the old value.
- Final check against the seed: all 41,500 person-week cells (500 people × 83 weeks) match an
  independent day-by-day query, and the grid matches the API cell for cell.

## Edit state lifted to the grid

- Open edits now live in `useWeeklyHoursEdits` at grid level instead of the cell, so a typed
  value, a save in flight and its error survive the row unmounting: during a range reload
  today, and when rows scroll out under virtualisation later. This resolves the two deferred
  editing items above.
