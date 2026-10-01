# Decisions

Yours to write, not your AI's. Short is good — bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- **Working days.** Not specified, so I count Monday to Friday. Assignments often run into
  the weekend; counting calendar days would put Ana at 56 h in a 40 h week. There's no
  holiday data, so Christmas and New Year weeks count as normal working weeks.
- **Start of the week.** Monday, following ISO. A range that starts or ends mid-week is
  widened to whole weeks, so a column always compares a full week against weekly capacity.
- **Range per request.** Production has thousands of people and two years of history but
  no stated limit per request. I cap a request at 26 weeks: two years is reachable by
  moving the window, and each response stays bounded.
- **Capacity history.** `weekly_hours` has no effective date, so changing someone's
  capacity also changes how past weeks are judged.
- **Over capacity.** Only strictly above capacity counts, so 40/40 is full, not over.
  Zero capacity with any allocation is over.
- **After saving.** The save waits for the server, so the grid never shows a value that
  wasn't stored. The row is then updated from the PATCH response without refetching the
  range, because capacity doesn't change allocation. A load that started before the save
  can't bring the old value back.
- **Failed saves.** The editor stays open with the typed value. A 4xx says it wasn't saved
  and why; a timeout (15 s), network error or 5xx says it may not have been saved.
  Retrying is safe because setting the same hours twice gives the same result.

## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- `hours_per_day` ranges from 0.125 to 1, and every assignment is stored as 15 rows
  (14 at one value, 1 at double). They look like duplicates but have to be summed:
  8,413 assignments sum to 2, 4, 6 or 8 h/day, and exactly one sums to 5. Deduplicating
  would undercount everyone.
- The hand-made cases confirm the reading: Ana's Mon–Sun assignment is 40/40 on weekdays
  (56 if weekends counted); Dee's overlapping projects make 45 against 40 in the week of
  Jan 5; Eli has 0 capacity and 20 h assigned, so a utilisation percentage makes no sense.
  The grid shows him as 20 over.
- Names sorted byte by byte on this Postgres image ("Álvarez" after "Ruiz"), so the query
  uses ICU collation.
- I checked the numbers end to end: all 41,500 person-week cells (500 people × 83 weeks)
  match a separate day-by-day query, and the rendered table matches the API cell for cell
  (54 over-capacity cells in the default range, all 54 marked).

## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

When I asked to keep an open edit alive across range changes, the AI moved the edit state
up to the grid, but every keystroke then re-rendered the whole table: about 13,500 cells,
90–260 ms per key. I noticed typing lagging in the browser. The fix was memoising rows
with stable edit actions so only the edited row re-renders; that brought it down to about
1 ms of React work per keystroke in a production build. Others I caught along the way:

- **Tests in the wrong place.** The AI's first tests only covered the frontend save flow.
  The part that breaks every number if it regresses is the allocation query, so I had it
  test that against Postgres: split rows, weekends, week boundaries, overlaps, clipping.
  I then had it trim the tests back when they grew into a full suite.
- **Pinned column overlapped when scrolling.** Faded zero cells were drawn over the sticky
  name column. They were faded with `opacity`, which put them on their own layer above it.
- **Unclear error message.** A failed load read "Couldn't load … Couldn't reach the server.
  Showing the weeks below instead", which repeated itself and didn't say which weeks were
  shown. It now names the range that failed and the range still on screen.

## What would you do differently with a week?

- **Scale.** Server-side paging or row virtualisation. Today 500 people × 26 weeks take
  0.5–1.2 s to render in dev while the API answers in ~50 ms, so rendering is what grows
  with the roster.
- **Capacity over time.** Effective dates, so a change doesn't rewrite past weeks, plus
  leave and public holidays that reduce a week's capacity and show as their own cell
  style, so red only ever means too much work. Both need schema changes.
- **Concurrent edits.** Last write wins today; a version check would tell a manager when
  someone else changed the same person.
- **Why is someone over?** Click an over-capacity cell to see the assignments behind it,
  and mark who has spare capacity, so the manager knows what to move and to whom.
- **Finding problems faster.** Search, an "only over capacity" filter, and the range in
  the URL so a view can be reloaded or shared.
- **Loading and errors.** Keep the previous grid visible (dimmed) while a range loads
  instead of a skeleton, confirm successful saves, and add an error boundary so a
  rendering bug doesn't blank the page.