package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
)

// Checked while holding the store lock, before mutating either cache or SQL.
type authoringConflict struct{ Current any }

func (e *authoringConflict) Error() string {
	return "Данные изменились в другом окне. Изменения не записаны; сравните черновик с актуальной версией."
}

func writeAuthoringError(w http.ResponseWriter, err error) bool {
	var conflict *authoringConflict
	if !errors.As(err, &conflict) {
		return false
	}
	writeCurrentConflict(w, "revision_conflict", conflict.Error(), conflict.Current)
	return true
}

func readEntityUpdate(r *http.Request) (createEntityInput, error) {
	var raw json.RawMessage
	if err := readJSON(r, &raw); err != nil {
		return createEntityInput{}, err
	}
	var input createEntityInput
	// Retain strict input validation, including for PATCH.
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return input, err
	}
	if r.Method == http.MethodPatch {
		if err := json.Unmarshal(raw, &input.patch); err != nil {
			return input, err
		}
	}
	return input, nil
}

func mergeEntityUpdate(existing knowledgeEntity, input createEntityInput) (createEntityInput, error) {
	if input.patch == nil {
		return input, nil
	}
	raw, err := json.Marshal(existing)
	if err != nil {
		return input, err
	}
	var fields map[string]json.RawMessage
	if err = json.Unmarshal(raw, &fields); err != nil {
		return input, err
	}
	for key, value := range input.patch {
		fields[key] = value
	}
	raw, err = json.Marshal(fields)
	if err != nil {
		return input, err
	}
	var merged createEntityInput
	if err = json.Unmarshal(raw, &merged); err != nil {
		return input, fmt.Errorf("invalid entity patch: %w", err)
	}
	return merged, nil
}

func requireRevisionQuery(w http.ResponseWriter, r *http.Request) (int, bool) {
	raw := r.URL.Query().Get("expectedRevision")
	if raw == "" {
		writeError(w, 428, "revision_required", "Обновите запись перед удалением: требуется исходная версия.")
		return 0, false
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		writeError(w, 400, "invalid_revision", "Некорректная версия.")
		return 0, false
	}
	return value, true
}
func readWorldEventUpdate(r *http.Request) (createWorldEventInput, error) {
	var raw json.RawMessage
	if err := readJSON(r, &raw); err != nil {
		return createWorldEventInput{}, err
	}
	var input createWorldEventInput
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return input, err
	}
	if r.Method == http.MethodPatch {
		if err := json.Unmarshal(raw, &input.patch); err != nil {
			return input, err
		}
	}
	return input, nil
}
func mergeWorldEventUpdate(existing worldEvent, input createWorldEventInput) (createWorldEventInput, error) {
	if input.patch == nil {
		return input, nil
	}
	raw, err := json.Marshal(existing)
	if err != nil {
		return input, err
	}
	var fields map[string]json.RawMessage
	if err = json.Unmarshal(raw, &fields); err != nil {
		return input, err
	}
	for key, value := range input.patch {
		fields[key] = value
	}
	raw, err = json.Marshal(fields)
	if err != nil {
		return input, err
	}
	var merged createWorldEventInput
	err = json.Unmarshal(raw, &merged)
	return merged, err
}

func writeCurrentConflict(w http.ResponseWriter, code, message string, current any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	_ = json.NewEncoder(w).Encode(envelope{Data: current, Error: &errorBody{Code: code, Message: message}})
}
