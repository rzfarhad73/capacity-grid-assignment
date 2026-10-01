package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
)

const (
	dateLayout = "2006-01-02"
	// maxWeeks bounds one response; the grid moves through history a window at a time.
	maxWeeks = 26
)

// capacityResponse: People[i].Allocated[j] is person i's hours in Weeks[j].
// Capacity is per person because the schema has one weekly_hours with no history.
type capacityResponse struct {
	From   string           `json:"from"` // Monday of the first week
	To     string           `json:"to"`   // Sunday of the last week
	Weeks  []string         `json:"weeks"`
	People []personCapacity `json:"people"`
}

type personCapacity struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	WeeklyHours float64   `json:"weekly_hours"`
	Allocated   []float64 `json:"allocated"`
}

// Allocation is hours_per_day × weekdays (Mon–Fri) each assignment covers in
// the week; overlapping assignments add up.
//
// ICU collation because the database default sorts by bytes ("Álvarez" after "Ruiz").
const capacityQuery = `
WITH weeks AS (
  SELECT unnest($1::date[]) AS week_start
),
alloc AS (
  SELECT a.person_id,
         w.week_start,
         SUM(a.hours_per_day * (LEAST(a.end_date, w.week_start + 4)
                              - GREATEST(a.start_date, w.week_start) + 1)) AS hours
  FROM weeks w
  JOIN assignments a
    ON a.start_date <= w.week_start + 4
   AND a.end_date   >= w.week_start
  GROUP BY a.person_id, w.week_start
)
SELECT p.id,
       p.name,
       p.weekly_hours::float8,
       COALESCE(al.hours, 0)::float8
FROM people p
CROSS JOIN weeks w
LEFT JOIN alloc al
  ON al.person_id = p.id
 AND al.week_start = w.week_start
ORDER BY p.name COLLATE "und-x-icu", p.id, w.week_start`

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD.
// The range is widened to whole Monday–Sunday weeks.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	weeks, err := parseWeekRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	rows, err := s.db.Query(r.Context(), capacityQuery, weeks)
	if err != nil {
		log.Printf("capacity: query: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}
	defer rows.Close()

	people := []personCapacity{}
	for rows.Next() {
		var (
			id          int
			name        string
			weeklyHours float64
			hours       float64
		)
		if err := rows.Scan(&id, &name, &weeklyHours, &hours); err != nil {
			log.Printf("capacity: scan: %v", err)
			writeError(w, http.StatusInternalServerError, "could not load capacity")
			return
		}
		// Rows are ordered by person then week, so a new id starts a new person.
		if len(people) == 0 || people[len(people)-1].ID != id {
			people = append(people, personCapacity{
				ID:          id,
				Name:        name,
				WeeklyHours: weeklyHours,
				Allocated:   make([]float64, 0, len(weeks)),
			})
		}
		p := &people[len(people)-1]
		p.Allocated = append(p.Allocated, hours)
	}
	if err := rows.Err(); err != nil {
		log.Printf("capacity: rows: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}

	writeJSON(w, http.StatusOK, capacityResponse{
		From:   weeks[0],
		To:     weekEnd(weeks[len(weeks)-1]),
		Weeks:  weeks,
		People: people,
	})
}

// weekEnd returns the Sunday of the week starting on monday (YYYY-MM-DD).
func weekEnd(monday string) string {
	t, _ := time.Parse(dateLayout, monday) // produced by parseWeekRange, always valid
	return t.AddDate(0, 0, 6).Format(dateLayout)
}

// parseWeekRange validates from/to and returns the Monday of every week that
// overlaps [from, to], as YYYY-MM-DD strings.
func parseWeekRange(fromStr, toStr string) ([]string, error) {
	from, err := time.Parse(dateLayout, fromStr)
	if err != nil {
		return nil, fmt.Errorf("from must be a date in YYYY-MM-DD format")
	}
	to, err := time.Parse(dateLayout, toStr)
	if err != nil {
		return nil, fmt.Errorf("to must be a date in YYYY-MM-DD format")
	}
	if to.Before(from) {
		return nil, fmt.Errorf("to must not be before from")
	}

	first, last := mondayOf(from), mondayOf(to)
	n := int(last.Sub(first).Hours()/24)/7 + 1
	if n > maxWeeks {
		return nil, fmt.Errorf("range covers %d weeks; the maximum is %d", n, maxWeeks)
	}

	weeks := make([]string, n)
	for i := range weeks {
		weeks[i] = first.AddDate(0, 0, 7*i).Format(dateLayout)
	}
	return weeks, nil
}

func mondayOf(t time.Time) time.Time {
	daysSinceMonday := (int(t.Weekday()) + 6) % 7
	return t.AddDate(0, 0, -daysSinceMonday)
}
