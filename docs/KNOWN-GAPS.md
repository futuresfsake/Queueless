# Known gaps

Last updated: 2026-11-12. This is the honest list of what is missing, unverified, or weaker than it looks. It feeds the README "Limitations" section. Remove an item only when it is fixed and verified.

## Not built
| Gap | Impact | Plan |
|---|---|---|
| **`/admin/audit` endpoint and UI.** | The auditor is a CLI only. | Cut rule in `invariant-auditor.md`. |
| **SMS** (two-way, outbox, Redis, BullMQ). | Patients are only notified through the live web page. | Post-MVP (ADR-005). |
| **Booking is today-only**, and booked patients queue FIFO (D-10). Slot time is informational. | A booking does not guarantee a call at that time. | Post-MVP. |
| **Wait-time estimates, simulator, chaos tests, usability test.** | No estimate shown to patients. No chaos or crash-recovery evidence. | Post-MVP. |
| **Cebuano / Filipino.** Strings are in one catalog but only English exists. | Language limits real use. | Post-MVP (D-16). Needs the owner's review. |

## Not verified
| Gap | Detail |
|---|---|
| **Purge timer has not run in a live process.** | `PurgeService` (30-day clearing of name and phone, INV-9) is tested by calling it directly (T-18) and is registered in the app, but the hourly timer is off under test and was not observed running. |
| **Browser coverage is one scripted pass, not a test suite.** | On 2026-11-12 a headless Chromium script (Playwright, run by hand, not in the repo or CI) drove the real stack and passed 17 of 17 checks: login and route guard, join and book flow on a 390 px phone width (no horizontal scroll), live updates to staff, patient and TV, Space to call next, start and complete, reconnect banner when the API server is stopped and again when it returns, admin creating a service point, STAFF kept out of `/admin`. It found one real bug (an invalid `pattern` regex on the admin form, fixed). **Not covered:** Firefox and Safari, real phones, slow networks, dark mode, accessibility audit, the slot booking button and the staff-account form in the browser, the TV on a real screen, visual design review. No E2E tests in CI yet. |
| **README quick start never run from a clean checkout.** | Written from the scripts and runbook; a step may be missing (the one-time role provisioning was added after review). |
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
