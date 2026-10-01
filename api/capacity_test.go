package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestParseWeekRange(t *testing.T) {
	tests := []struct {
		name, from, to string
		first          string
		weeks          int
		wantErr        bool
	}{
		{name: "widens to whole weeks", from: "2026-01-07", to: "2026-01-14", first: "2026-01-05", weeks: 2},
		{name: "week across a year boundary", from: "2025-12-31", to: "2026-01-01", first: "2025-12-29", weeks: 1},
		{name: "26 weeks is the maximum", from: "2026-01-05", to: "2026-07-05", first: "2026-01-05", weeks: 26},
		{name: "27 weeks", from: "2026-01-05", to: "2026-07-06", wantErr: true},
		{name: "SQL in a date", from: "2026-01-05' OR 1=1--", to: "2026-01-11", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseWeekRange(tt.from, tt.to)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("want an error, got %v", got)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != tt.weeks || got[0] != tt.first {
				t.Fatalf("got %v, want %d weeks from %s", got, tt.weeks, tt.first)
			}
		})
	}
}

func TestCapacityHidesDatabaseErrors(t *testing.T) {
	db, err := pgxpool.New(context.Background(),
		"postgres://nobody:secret@127.0.0.1:1/nowhere?connect_timeout=1")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	s := &server{db: db}

	rec := httptest.NewRecorder()
	s.handleCapacity(rec, httptest.NewRequest(http.MethodGet,
		"/api/capacity?from=2026-01-05&to=2026-01-11", nil))

	assertJSONError(t, rec, http.StatusInternalServerError)
	if body := strings.TrimSpace(rec.Body.String()); body != `{"error":"could not load capacity"}` {
		t.Fatalf("body %s leaks more than a generic message", body)
	}
}

// TestCapacityQuery runs the allocation query against Postgres with its own
// people and assignments, inside a transaction that is rolled back, so the seed
// is neither needed nor changed. It needs DATABASE_URL, which the api container
// has: docker compose exec api go test ./...
func TestCapacityQuery(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)

	var projectID int
	if err := tx.QueryRow(ctx,
		`INSERT INTO projects (name) VALUES ('Test project') RETURNING id`,
	).Scan(&projectID); err != nil {
		t.Fatal(err)
	}

	// Requested weeks start on Mon 2030-01-07, 2030-01-14 and 2030-01-21.
	weeks := []string{"2030-01-07", "2030-01-14", "2030-01-21"}

	type assignment struct {
		start, end  string
		hoursPerDay float64
	}
	scenarios := []struct {
		name        string
		assignments []assignment
		want        []float64
	}{
		{
			name: "rows for the same days add up",
			assignments: []assignment{
				{"2030-01-07", "2030-01-11", 3},
				{"2030-01-07", "2030-01-11", 3},
				{"2030-01-07", "2030-01-11", 2},
			},
			want: []float64{40, 0, 0},
		},
		{
			name:        "weekends don't count",
			assignments: []assignment{{"2030-01-07", "2030-01-13", 8}},
			want:        []float64{40, 0, 0},
		},
		{
			name:        "Fri–Mon splits across the week boundary",
			assignments: []assignment{{"2030-01-11", "2030-01-14", 8}},
			want:        []float64{8, 8, 0},
		},
		{
			name: "overlapping projects add up",
			assignments: []assignment{
				{"2030-01-07", "2030-01-11", 6},
				{"2030-01-09", "2030-01-11", 5},
			},
			want: []float64{45, 0, 0},
		},
		{
			name: "clipped to the requested weeks",
			assignments: []assignment{
				{"2029-12-24", "2030-01-08", 2}, // starts two weeks early
				{"2030-01-25", "2030-02-15", 2}, // runs past the last week
			},
			want: []float64{4, 0, 2},
		},
		{
			name: "no assignments still gets a row",
			want: []float64{0, 0, 0},
		},
	}

	ids := make(map[int]int) // person id → scenario index
	for i, s := range scenarios {
		var id int
		if err := tx.QueryRow(ctx,
			`INSERT INTO people (name, weekly_hours) VALUES ($1, 40) RETURNING id`, s.name,
		).Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids[id] = i
		for _, a := range s.assignments {
			if _, err := tx.Exec(ctx,
				`INSERT INTO assignments (person_id, project_id, start_date, end_date, hours_per_day)
				 VALUES ($1, $2, $3, $4, $5)`,
				id, projectID, a.start, a.end, a.hoursPerDay,
			); err != nil {
				t.Fatal(err)
			}
		}
	}

	rows, err := tx.Query(ctx, capacityQuery, weeks)
	if err != nil {
		t.Fatal(err)
	}
	got := make([][]float64, len(scenarios))
	for rows.Next() {
		var (
			id          int
			name        string
			weeklyHours float64
			hours       float64
		)
		if err := rows.Scan(&id, &name, &weeklyHours, &hours); err != nil {
			t.Fatal(err)
		}
		if i, ok := ids[id]; ok {
			got[i] = append(got[i], hours)
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	for i, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			if !slices.Equal(got[i], s.want) {
				t.Errorf("allocated %v, want %v", got[i], s.want)
			}
		})
	}
}
