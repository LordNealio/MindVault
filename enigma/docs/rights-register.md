# Rights register (placeholder)

No restricted-content provider is integrated in this scaffold. This file is the stub the rights
engine reads from once a contract exists. Do not add provider keys to `.env` before the gate below
is enforced in code.

## Required rights (ask vendors in writing — "licensed lyrics API" does NOT answer these)

| Right | Column it maps to |
|---|---|
| Retrieve complete text | (operation) `retrieve` |
| Cache temporarily | `may_cache` |
| Store permanently | `may_store` |
| Build inverted full-text index | `may_fulltext_index` |
| Extract NER / themes / counts | `may_compute_features` |
| Generate phonetic representations | `may_compute_features` |
| Generate embeddings | `may_create_embeddings` |
| Send text to named AI subprocessors | `may_send_to_third_party_ai` |
| Run local/self-hosted models | `may_process_local` |
| Store derived features after deleting text | `retention_expires_at` + `deletion_required` |
| Show quotations/snippets to researchers | `may_display` |
| Process catalogs in bulk | (contract term) |
| Operate commercially | (contract term) |
| Process by territory | `territory` |
| Preserve source hashes / version metadata | `source_hash` |

## Vendor order

MusicBrainz → Wikidata → Musixmatch proof-of-concept → LyricFind commercial comparison → Discogs →
optional Apple / Spotify / YouTube / Last.fm adapters.

**Spotify is a special, especially restrictive case:** its Developer Policy forbids ingesting Spotify
Content into ML/AI models. Spotify-origin content must be architecturally prevented from reaching the
semantic/AI pipeline. ID/link adapter only.
