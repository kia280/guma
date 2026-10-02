package event

import "strings"

type eventFields struct {
	Title    string
	Type     string
	Priority string
}

func normalizeFields(f eventFields) eventFields {
	if f.Priority == "" {
		f.Priority = "medium"
	}
	if f.Type == "" {
		f.Type = "other"
	}
	f.Title = strings.TrimSpace(f.Title)
	return f
}
