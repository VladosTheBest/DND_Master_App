package httpapi

import (
	"encoding/json"
	"reflect"
	"sort"
)

// Merge only the proposal's changes. Arrays are atomic: conflicting edits must
// be reviewed, never guessed. Unrelated authoring changes remain intact.
func mergeProposalSnapshot(before, after, current json.RawMessage) (json.RawMessage, error) {
	var base, proposed, live any
	for _, entry := range []struct {
		raw    json.RawMessage
		target *any
	}{{before, &base}, {after, &proposed}, {current, &live}} {
		if err := json.Unmarshal(entry.raw, entry.target); err != nil {
			return nil, err
		}
	}
	merged, err := mergeProposalValue(base, proposed, live, "")
	if err != nil {
		return nil, err
	}
	return json.Marshal(merged)
}

func mergeProposalValue(base, proposed, live any, path string) (any, error) {
	if path == "/revision" || reflect.DeepEqual(base, proposed) {
		return live, nil
	}
	if reflect.DeepEqual(base, live) || reflect.DeepEqual(proposed, live) {
		return proposed, nil
	}
	b, bok := base.(map[string]any)
	p, pok := proposed.(map[string]any)
	l, lok := live.(map[string]any)
	if bok && pok && lok {
		keys := map[string]bool{}
		for key := range b {
			keys[key] = true
		}
		for key := range p {
			keys[key] = true
		}
		for key := range l {
			keys[key] = true
		}
		ordered := make([]string, 0, len(keys))
		for key := range keys {
			ordered = append(ordered, key)
		}
		sort.Strings(ordered)
		result := map[string]any{}
		for _, key := range ordered {
			bv, be := b[key]
			pv, pe := p[key]
			lv, le := l[key]
			if be == pe && reflect.DeepEqual(bv, pv) {
				if le {
					result[key] = lv
				}
				continue
			}
			if be == le && reflect.DeepEqual(bv, lv) {
				if pe {
					result[key] = pv
				}
				continue
			}
			if pe == le && reflect.DeepEqual(pv, lv) {
				if le {
					result[key] = lv
				}
				continue
			}
			value, err := mergeProposalValue(bv, pv, lv, path+"/"+key)
			if err != nil {
				return nil, err
			}
			result[key] = value
		}
		return result, nil
	}
	return nil, proposalFailure(409, "stale_revision", "Это поле изменено и в карточке, и в черновике: "+path+". Проверь актуальную карточку перед новым предложением.")
}

func proposalCurrentSnapshot(proposal aiProposal, campaign campaignData) (json.RawMessage, error) {
	if proposal.Kind == "entity_update" {
		entity := proposalTargetEntity(campaign, proposal.Target)
		if entity.ID == "" {
			return nil, staleRevisionFailure("entity")
		}
		return json.Marshal(entity)
	}
	_, event := findEventInCampaign(&campaign, proposal.Target.EventID)
	if event.ID == "" {
		return nil, staleRevisionFailure("event")
	}
	return json.Marshal(event)
}

func mergeCurrentProposal(proposal *aiProposal, campaign campaignData) error {
	current, err := proposalCurrentSnapshot(*proposal, campaign)
	if err != nil {
		return err
	}
	merged, err := mergeProposalSnapshot(proposal.Before, proposal.After, current)
	if err != nil {
		return err
	}
	// Undo and audit must use the actual snapshot immediately before applying.
	proposal.Before, proposal.After = current, merged
	proposal.Diff = diffJSON(current, merged)
	return nil
}
