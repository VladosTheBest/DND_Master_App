package httpapi

// authAccountRepository is the persistence boundary used by password and OAuth
// authentication. Implementations must resolve/link/replace provider identities
// atomically and enforce uniqueness of (provider, subject) across accounts.
// Internal user IDs and password hashes must survive backend migrations.
type authAccountRepository interface {
	bootstrapLegacyUser(username, password string) error
	createUser(username, password string) (userAccount, error)
	findUserByUsername(username string) (userAccount, bool)
	getUserByID(userID string) (userAccount, bool)
	resolveOAuthUser(provider, subject, linkUserID string, replace bool, labels ...string) (userAccount, error)
}
