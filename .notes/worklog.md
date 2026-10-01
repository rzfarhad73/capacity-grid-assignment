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
