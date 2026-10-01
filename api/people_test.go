package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// Invalid requests are rejected before the database is touched, so these run
// without one.
func TestUpdatePersonRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name, id, body string
	}{
		{"SQL in id", "1;DROP TABLE people", `{"weekly_hours": 32}`},
		{"missing weekly_hours", "1", `{}`},
		{"more hours than a week", "1", `{"weekly_hours": 168.5}`},
		{"oversized body", "1", `{"weekly_hours": 32, "x": "` + strings.Repeat("a", 2048) + `"}`},
	}
	s := &server{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPatch,
				"/api/people/"+url.PathEscape(tt.id), strings.NewReader(tt.body))
			req.SetPathValue("id", tt.id)
			rec := httptest.NewRecorder()

			s.handleUpdatePerson(rec, req)

			assertJSONError(t, rec, http.StatusBadRequest)
		})
	}
}
