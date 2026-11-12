# Known gaps

Last updated: 2026-11-12. This is the honest list of what is missing, unverified, or weaker than it looks. It feeds the README "Limitations" section. Remove an item only when it is fixed and verified.

## Not built
| Gap | Impact | Plan |
|---|---|---|
| **Clinic Admin screen.** Service points, staff accounts and slots can only be created through the API (or `seed:demo`). | The demo cannot be set up from the UI. A reviewer needs the seeded demo clinic. | Draft exists (not in the repo, did not typecheck). Build after deploy if time allows. |
| **Phone and name purge job** (INV-9, 30 days). | Auditor check A-7 passes only because no data is that old yet. The data-privacy promise is not enforced by code. | P1. Must exist before any real use. |
| **`/admin/audit` endpoint and UI.** | The auditor is a CLI only. | Cut rule in `invariant-auditor.md`. |
| **SMS** (two-way, outbox, Redis, BullMQ). | Patients are only notified through the live web page. | Post-MVP (ADR-005). |
| **Booking is today-only**, and booked patients queue FIFO (D-10). Slot time is informational. | A booking does not guarantee a call at that time. | Post-MVP. |
| **Wait-time estimates, simulator, chaos tests, usability test.** | No estimate shown to patients. No chaos or crash-recovery evidence. | Post-MVP. |
| **Cebuano / Filipino.** Strings are in one catalog but only English exists. | Language limits real use. | Post-MVP (D-16). Needs the owner's review. |

## Not verified
| Gap | Detail |
|---|---|
| **No browser check of any web page.** | Pages typecheck and build, and the API calls behind them were exercised with scripts. Layout, mobile view, the Space shortcut, the reconnect banner and the TV screen have not been looked at. No Playwright tests yet. |
| **Not deployed.** | The Railway and Vercel first deploy (F6 gate) is still waiting on accounts. Nothing here has run in production. |
| **k6 and the auditor are not in CI.** | They were run by hand on one laptop. CI runs Jest and Testcontainers only. |
| **Performance numbers are local.** | Laptop, API in dev mode, Postgres in Docker on the same machine, one client, small data set, rate limit lifted for the race test. They show correctness under concurrency, not production capacity. |
| **Reconnect after a real network drop** was not tested end to end. | Only the code path (refetch on socket connect) exists. |

## Known weaker points (by design for the MVP)
- **Single API server.** Rate limits and login throttling are in memory; a second server would not share them (ADR-005). Sockets are a single Socket.IO server with no Redis adapter.
- **Per-IP limits hurt shared networks.** A clinic behind one NAT address shares the 30 writes per minute limit. Configurable with `PUBLIC_WRITE_LIMIT`.
- **A known email can be locked out for 15 minutes** by repeated failed logins (accepted trade-off, D-28).
- **The ticket link is the patient's only credential.** Anyone who gets the link can see and cancel that ticket. It is 256-bit and expires 24 hours after the ticket finishes.
- **Auditor checks consistency, not truth.** It cannot know about a patient who walked away (see `invariant-auditor.md`). Its default window is 7 days.
- **The auditor's read-only guarantee is by construction** (SELECT-only SQL), not enforced by a read-only transaction.
- **Staff JWT is stored in `localStorage`.** Standard for this kind of app but exposed to any XSS; there is no refresh-token flow (8 hour token).
- **Demo accounts** use a password from the environment and are shared out of band; none are in the repo.

## Housekeeping
- Git history was rewritten on 2026-11-12 to remove tool attribution from commits; a local backup branch `backup-before-rewrite` still holds the old history.
- Several `docs/` files still describe the first design (for example the socket event names in `api.md`); `api.md` has a dated "Implemented in" section that wins where they differ.
