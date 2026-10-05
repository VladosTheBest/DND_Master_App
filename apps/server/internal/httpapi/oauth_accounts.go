package httpapi

import (
	"errors"
	"fmt"
	"time"
)

func (store *campaignStore) resolveOAuthUser(provider, subject, linkUserID string, replace bool, labels ...string) (userAccount, error) {
	if (provider != "google" && provider != "discord") || subject == "" {
		return userAccount{}, errors.New("invalid identity")
	}
	label := ""
	if len(labels) > 0 {
		label = labels[0]
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	target := -1
	for i, user := range store.data.Users {
		if user.ID == linkUserID {
			target = i
		}
		for _, id := range user.OAuthIdentities {
			if id.Provider == provider && id.Subject == subject {
				if linkUserID != "" && user.ID != linkUserID {
					return userAccount{}, errIdentityConflict
				}
				return user, nil
			}
		}
	}
	if linkUserID != "" && target < 0 {
		return userAccount{}, errors.New("account missing")
	}
	original, e := cloneStorageState(store.data)
	if e != nil {
		return userAccount{}, e
	}
	if target < 0 {
		id := newID("user")
		// A generated unique username avoids collisions with password accounts and
		// never uses an email address as an account-linking key.
		username := provider + "_" + id
		store.data.Users = append(store.data.Users, userAccount{ID: id, Username: username, UsernameKey: normalizeUsernameKey(username), CreatedAt: time.Now().UTC().Format(time.RFC3339)})
		target = len(store.data.Users) - 1
		if len(store.data.Users) == 1 {
			store.assignUnownedCampaignsLocked(id)
		}
	}
	for i, id := range store.data.Users[target].OAuthIdentities {
		if id.Provider == provider {
			if !replace {
				return userAccount{}, errIdentityConflict
			}
			store.data.Users[target].OAuthIdentities[i] = oauthIdentity{Provider: provider, Subject: subject, Label: label}
			user := store.data.Users[target]
			if e := store.saveMutationLocked(original); e != nil {
				return userAccount{}, e
			}
			return user, nil
		}
	}
	store.data.Users[target].OAuthIdentities = append(store.data.Users[target].OAuthIdentities, oauthIdentity{Provider: provider, Subject: subject, Label: label})
	user := store.data.Users[target]
	if e := store.saveMutationLocked(original); e != nil {
		return userAccount{}, fmt.Errorf("persist oauth account: %w", e)
	}
	return user, nil
}
