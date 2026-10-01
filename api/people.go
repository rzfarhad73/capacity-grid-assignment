package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

const maxWeeklyHours = 168

type updatePersonRequest struct {
	WeeklyHours *float64 `json:"weekly_hours"`
}

type person struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	WeeklyHours float64 `json:"weekly_hours"`
}

// handleUpdatePerson serves PATCH /api/people/{id} with {"weekly_hours": n}
// and returns the person as stored. Capacity doesn't affect allocation, so the
// response is all the grid needs to update that person's row.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "id must be a positive integer")
		return
	}

	var req updatePersonRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, `body must be JSON like {"weekly_hours": 32}`)
		return
	}
	if req.WeeklyHours == nil {
		writeError(w, http.StatusBadRequest, "weekly_hours is required")
		return
	}
	hours := *req.WeeklyHours
	if hours < 0 || hours > maxWeeklyHours {
		writeError(w, http.StatusBadRequest, "weekly_hours must be between 0 and 168")
		return
	}

	var p person
	err = s.db.QueryRow(r.Context(), `
		UPDATE people
		SET weekly_hours = $1
		WHERE id = $2
		RETURNING id, name, weekly_hours::float8`,
		hours, id,
	).Scan(&p.ID, &p.Name, &p.WeeklyHours)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "person not found")
		return
	}
	if err != nil {
		log.Printf("update person %d: %v", id, err)
		writeError(w, http.StatusInternalServerError, "could not save weekly hours")
		return
	}

	writeJSON(w, http.StatusOK, p)
}
