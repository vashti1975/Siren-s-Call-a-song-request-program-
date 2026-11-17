# Rebuilding the basic application

This is a reusable starter with an empty catalog and generic appearance. It excludes the owner's songs, song lists, lengths, saved filename matches, personal artwork, account-specific grants and runtime snapshots. It has no production Site ID and does not affect the original live songbook.

Follow SETUP.md to install dependencies, copy the local environment example, apply schema migrations and run the app. Open the owner page to add songs and choose an appearance. The default theme is neutral and the chibi is generic.

Publish a new server-backed deployment with a D1 `DB` binding and trusted authentication. Set the owner email outside Git. Pair the optional companion with that deployment's URL and a new key.

The source repository is not a backup of runtime requests, profiles, rewards or credentials. Back up a deployment's database separately using its provider. Keep personal songs, databases and secrets outside this repository.
