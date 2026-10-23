package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	_ = json.NewEncoder(w).Encode(envelope{Data: conflict.Current, Error: &errorBody{Code: "revision_conflict", Message: conflict.Error()}})
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
