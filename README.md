# orisonlabs/models

The model catalog the switchyard Claude lane serves, published at

    https://raw.githubusercontent.com/orisonlabs/models/main/models.json

It is upstream [router-for-me/models](https://github.com/router-for-me/models) `models.json` plus `overlay.json`. CLIProxyAPI (8.x) reads it through `models.catalog` in the lane config instead of the official URL.

## Why

CLIProxyAPI rejects any model id its catalog does not carry with `400 unknown provider for model`, and it fetches that catalog from upstream at boot and every 3 h. Upstream has both lagged new Claude ids (claude-opus-5-5, 2026-09-22) and deleted a live one (claude-haiku-5-5, removed 2026-10-12 17:58Z, which broke WebFetch in every relayed session). Owning the source means an upstream deletion cannot take an id away from us, while upstream additions still arrive.

## Files

| File | Role |
|---|---|
| `upstream/models.json` | verbatim copy of upstream `main`, refreshed by the Action |
| `overlay.json` | provider section → entries that must exist; same entry shape as upstream |
| `models.json` | generated: upstream + overlay. Never edit by hand |
| `scripts/merge.mjs` | the merge; `scripts/merge.test.mjs` pins the rules |
| `.github/workflows/sync.yml` | every 2 h, on dispatch, and on a push that touches the overlay or scripts |

## Rules

- **Upstream wins.** An overlay entry is appended only when upstream has no entry with that id. When upstream carries the id, the upstream entry is used untouched, so the overlay is a floor, not a patch.
- Sections the overlay does not name pass through verbatim.
- A push by the workflow's own token starts no further run.

## Adding or removing an id

1. Edit `overlay.json` (copy the entry shape from `upstream/models.json`; the `claude-haiku-5-5` entry is the one upstream carried in commit e63af98).
2. `npm test && npm run merge`, commit `overlay.json` and the regenerated `models.json`, push to `main`. The Action re-runs the merge on that push as a check.
3. The lane picks it up at its next 3 h refresh; `systemctl --user restart switchyard-claude` on the box makes it immediate. raw.githubusercontent.com caches a path for up to 5 min after a push.

Remove an entry from the overlay once upstream carries it again, or when the provider really retired it: an overlay id the provider no longer serves fails at the provider instead of at the proxy.

## Failure modes

- Fetch fails (GitHub down, repo renamed): CLIProxyAPI keeps the last valid catalog and logs `model catalog refresh failed`. A custom source never falls back to the official URL.
- GitHub disables scheduled workflows in a repository with no activity for 60 days. The sync commits normally keep it active; if `upstream/models.json` stops moving, run the workflow by hand from the Actions tab.
