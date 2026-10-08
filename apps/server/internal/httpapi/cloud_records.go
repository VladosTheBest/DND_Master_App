package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
)

// The compatibility cache is reconstructed from independently addressable rows.
// Keeping the codec separate makes lossless migration testable without a database.
type cloudRecord struct {
	Table, Key, ID, Parent, Kind string
	Position                     int
	Body                         json.RawMessage
}

var cloudCollections = []struct{ Field, Table string }{
	{"foundryConnections", "foundry_connections"}, {"foundryReceipts", "foundry_receipts"},
	{"users", "accounts"}, {"campaigns", "campaigns"},
	{"importedSessions", "game_sessions"}, {"aiProposals", "ai_proposals"},
	{"proposalAudits", "proposal_audits"}, {"surveyInvites", "survey_invites"},
	{"surveyResponses", "survey_responses"}, {"characterInvites", "character_invites"},
	{"characterSheets", "character_sheets"},
	{"subscriptionAudits", "subscription_audits"},
	{"feedback", "feedback"},
	{"aiChatTurns", "ai_chat_turns"},
}

var cloudChildren = []struct{ Field, Table string }{
	{"locations", "entities"}, {"players", "entities"}, {"npcs", "entities"},
	{"monsters", "entities"}, {"quests", "entities"}, {"lore", "entities"},
	{"events", "world_events"}, {"shops", "shops"}, {"sessionPrep", "session_preparations"},
	{"combatPlaylist", "playlist_tracks"},
}

var cloudTables = []string{"foundry_connections", "foundry_receipts", "accounts", "oauth_identities", "subscriptions", "campaigns", "entities", "world_events", "shops", "session_preparations", "playlist_tracks", "game_sessions", "transcripts", "session_analyses", "ai_proposals", "proposal_audits", "survey_invites", "survey_responses", "character_invites", "character_sheets", "subscription_audits", "feedback", "ai_chat_turns"}

func rawString(object map[string]json.RawMessage, key string) string {
	var result string
	_ = json.Unmarshal(object[key], &result)
	return result
}

func recordKey(parts ...any) string { body, _ := json.Marshal(parts); return string(body) }

func splitCloudState(state storageState) (json.RawMessage, []cloudRecord, error) {
	body, err := json.Marshal(state)
	if err != nil {
		return nil, nil, err
	}
	var root map[string]json.RawMessage
	if err = json.Unmarshal(body, &root); err != nil {
		return nil, nil, err
	}
	records := []cloudRecord{}
	for _, collection := range cloudCollections {
		var values []json.RawMessage
		if err = json.Unmarshal(root[collection.Field], &values); err != nil && len(root[collection.Field]) > 0 {
			return nil, nil, err
		}
		for index, value := range values {
			var object map[string]json.RawMessage
			if err = json.Unmarshal(value, &object); err != nil {
				return nil, nil, err
			}
			id := rawString(object, "id")
			if collection.Table == "character_sheets" {
				var sheet map[string]json.RawMessage
				if err = json.Unmarshal(object["sheet"], &sheet); err != nil {
					return nil, nil, err
				}
				id = rawString(sheet, "id")
			}
			if collection.Table == "survey_invites" || collection.Table == "character_invites" {
				token := rawString(object, "token")
				if token == "" {
					return nil, nil, fmt.Errorf("missing invite token in %s", collection.Table)
				}
				digest := sha256.Sum256([]byte(token))
				id = hex.EncodeToString(digest[:])
			}
			if id == "" {
				return nil, nil, fmt.Errorf("missing record ID in %s", collection.Table)
			}
			if collection.Table == "campaigns" {
				for _, child := range cloudChildren {
					var children []json.RawMessage
					if err = json.Unmarshal(object[child.Field], &children); err != nil && len(object[child.Field]) > 0 {
						return nil, nil, err
					}
					for position, payload := range children {
						var item map[string]json.RawMessage
						if err = json.Unmarshal(payload, &item); err != nil {
							return nil, nil, err
						}
						records = append(records, cloudRecord{child.Table, recordKey(id, child.Field, position), rawString(item, "id"), id, child.Field, position, payload})
					}
					if len(children) > 0 {
						object[child.Field] = json.RawMessage(`[]`)
					}
				}
			}
			if collection.Table == "accounts" {
				var identities []json.RawMessage
				if len(object["oauthIdentities"]) > 0 {
					if err = json.Unmarshal(object["oauthIdentities"], &identities); err != nil {
						return nil, nil, err
					}
				}
				for position, payload := range identities {
					records = append(records, cloudRecord{"oauth_identities", recordKey(id, position), "", id, "oauthIdentities", position, payload})
				}
				if len(identities) > 0 {
					delete(object, "oauthIdentities")
				}
				if payload := object["subscription"]; len(payload) > 0 && string(payload) != "null" {
					records = append(records, cloudRecord{"subscriptions", id, id, id, "subscription", 0, payload})
					delete(object, "subscription")
				}
			}
			if collection.Table == "game_sessions" {
				for _, child := range []struct{ field, table string }{{"text", "transcripts"}, {"analysis", "session_analyses"}} {
					if payload := object[child.field]; len(payload) > 0 {
						records = append(records, cloudRecord{child.table, id, id, id, child.field, 0, payload})
						delete(object, child.field)
					}
				}
			}
			payload, err := json.Marshal(object)
			if err != nil {
				return nil, nil, err
			}
			records = append(records, cloudRecord{collection.Table, id, id, "", collection.Field, index, payload})
		}
		if len(values) > 0 {
			root[collection.Field] = json.RawMessage(`[]`)
		}
	}
	meta, err := json.Marshal(root)
	seen := map[string]bool{}
	for _, record := range records {
		key := record.Table + "/" + record.Key
		if seen[key] {
			return nil, nil, fmt.Errorf("duplicate record in %s", record.Table)
		}
		seen[key] = true
	}
	return meta, records, err
}

func joinCloudState(meta json.RawMessage, records []cloudRecord) (storageState, error) {
	var root map[string]json.RawMessage
	if err := json.Unmarshal(meta, &root); err != nil {
		return storageState{}, err
	}
	children := map[string][]cloudRecord{}
	for _, record := range records {
		if record.Parent != "" {
			children[record.Parent] = append(children[record.Parent], record)
		}
	}
	sort.SliceStable(records, func(i, j int) bool { return records[i].Position < records[j].Position })
	for _, collection := range cloudCollections {
		values := []json.RawMessage{}
		for _, record := range records {
			if record.Table != collection.Table {
				continue
			}
			var object map[string]json.RawMessage
			if err := json.Unmarshal(record.Body, &object); err != nil {
				return storageState{}, err
			}
			arrayFields := map[string][]cloudRecord{}
			for _, child := range children[record.ID] {
				valid := (record.Table == "accounts" && (child.Table == "oauth_identities" || child.Table == "subscriptions")) || (record.Table == "game_sessions" && (child.Table == "transcripts" || child.Table == "session_analyses"))
				if record.Table == "campaigns" {
					for _, spec := range cloudChildren {
						if child.Table == spec.Table && child.Kind == spec.Field {
							valid = true
						}
					}
				}
				if !valid {
					continue
				}
				if child.Table == "subscriptions" || child.Table == "transcripts" || child.Table == "session_analyses" {
					object[child.Kind] = child.Body
				} else {
					arrayFields[child.Kind] = append(arrayFields[child.Kind], child)
				}
			}
			for field, items := range arrayFields {
				sort.Slice(items, func(i, j int) bool { return items[i].Position < items[j].Position })
				array := make([]json.RawMessage, len(items))
				for i := range items {
					array[i] = items[i].Body
				}
				object[field], _ = json.Marshal(array)
			}
			body, err := json.Marshal(object)
			if err != nil {
				return storageState{}, err
			}
			values = append(values, body)
		}
		if len(values) > 0 {
			root[collection.Field], _ = json.Marshal(values)
		}
	}
	body, err := json.Marshal(root)
	if err != nil {
		return storageState{}, err
	}
	var state storageState
	err = json.Unmarshal(body, &state)
	return state, err
}
