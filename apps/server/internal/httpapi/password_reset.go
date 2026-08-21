package httpapi

import (
	"fmt"
	"strings"
)

// ResetAccountPassword replaces one account's password hash without changing
// its campaigns or any other stored application data.
func ResetAccountPassword(dataFile string, username string, password string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("укажи логин")
	}
	if err := validateAccountPassword(password); err != nil {
		return err
	}

	passwordHash, err := hashPassword(password)
	if err != nil {
		return err
	}

	store, err := newCampaignStore(dataFile)
	if err != nil {
		return err
	}

	usernameKey := normalizeUsernameKey(username)
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Users {
		if store.data.Users[index].UsernameKey == usernameKey {
			store.data.Users[index].PasswordHash = passwordHash
			return store.saveLocked()
		}
	}

	return fmt.Errorf("пользователь %q не найден", username)
}
