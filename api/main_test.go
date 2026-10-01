package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// assertJSONError checks the status and that the body is a JSON error, never
// HTML or a raw driver message.
func assertJSONError(t *testing.T, rec *httptest.ResponseRecorder, status int) {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("status %d, want %d (%s)", rec.Code, status, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type %q, want application/json", ct)
	}
	if !strings.HasPrefix(rec.Body.String(), `{"error":`) {
		t.Fatalf("body %s, want a JSON error", rec.Body)
	}
}
