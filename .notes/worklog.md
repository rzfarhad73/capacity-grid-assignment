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
