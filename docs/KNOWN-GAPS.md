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
| **Deployed as a free-tier demo, lightly checked.** | Live on Render + Neon since 2026-11-13 (PostgreSQL 18 on Neon; tests and the rehearsal ran on 16). Checked by hand: health, web app and deep links, 401 without a token, staff login, TV board endpoint. On 2026-11-13 a scripted Chrome pass against the live site also joined three patients, signed in as staff, used Call next and checked the TV, patient and admin pages (screenshots in the README). The invariant auditor was run against the deployed database: A-1..A-5, A-7 and A-8 pass on the demo clinic's 3 tickets and 4 events. **A-6 reported FAIL only because I ran the auditor connected as Neon's owner role**; the app role's posture was checked directly in the catalog instead (not superuser, no BYPASSRLS, owns no tables, INSERT and SELECT only on `queue_events`, forced RLS on every table), and the container's start-up guard has to pass for the app to start at all. **Not checked on the live site:** k6 load tests, the purge timer, real-device phones, and behaviour under real use. The instance sleeps when idle unless an uptime monitor pings `/api/v1/health/live`. The auditor data set is tiny (3 tickets), so those passes prove little about scale. |
| **k6 and the auditor are not in CI.** | They were run by hand on one laptop. CI runs Jest and Testcontainers only. |
| **Performance numbers are local.** | Laptop, API in dev mode, Postgres in Docker on the same machine, one client, small data set, rate limit lifted for the race test. They show correctness under concurrency, not production capacity. |
| **Reconnect after a real network drop** was not tested end to end. | Only the code path (refetch on socket connect) exists. |

## Design (2026-11-12, second pass)
- The first redesign (cream paper, serif headings, orange accent) was rejected because it looked like a generated page. Replaced the same day with a different identity: white and black stock, a yellow marker accent, square edges, ruled tables, monospace numbers, a receipt-style patient ticket, and a red-on-black LED board for the TV.
- Reviewed by eye from Chromium screenshots at phone (390 px), laptop (1280 px) and TV (1920x1080) sizes, and the 17 functional browser checks pass on the new screens. **Not done:** a formal accessibility audit (contrast was reasoned about, not measured with a tool, and the red LED digits and yellow marker were not checked for colour-blind users), screen-reader testing, Firefox and Safari rendering, very small phones (under 360 px), the TV on a real display, and any testing with real patients or staff. "Looks hand-made" is a taste judgement, not a tested result.
- Fonts (IBM Plex Sans and Mono) are bundled from npm, not loaded from a CDN.
- The receipt edge uses CSS masks; very old browsers will show a plain rectangle.

## Design (2026-11-12, third pass: refinement)
- The second-pass look (yellow marker, LED board) was replaced by the calm blue "clinic" system in `f31be07`. This pass kept that layout and removed what made it look generated: floating shadowed cards on a grey page, icon tiles, pill badges, filler subtitles, a three-card home page. It now uses a white page, hairlines, small radii, flat status tags, a real table for the waiting list and a ticket laid out like a paper stub.
- The home page (`/`) is now a product page: what it is, how it works, demo links, the measured results with their conditions, privacy and what is not built. Its numbers are copied from `README.md`; change both together. Its demo links point at `VITE_DEMO_SLUG` (default `demo-clinic`), which only exists after `seed:demo` has run against that database.
- Queue numbers stay in IBM Plex Sans (tabular digits). IBM Plex Mono was tried and dropped because its zero is dotted, which is easy to misread on a ticket.
- The TV sizes the "now serving" number from its length, so a three-letter prefix shrinks instead of clipping. Checked only with `G-001` style numbers at 1920x1080.
- Checked by one scripted headless-Chromium pass (not in the repo): home, login, join, ticket, staff, Call next with Space, the three admin tabs and the TV rendered with no page errors, at 1280 px, 390 px and 1920x1080. The home page was also measured at 360 px (no horizontal scroll). **Not done:** the earlier 17 functional checks were not re-run as a set, and the open items from the second pass (accessibility audit, Firefox and Safari, real phones, a real TV) still apply.
- **Build fix found on the way:** the web app imported a value (`SERVICE_ICONS`) from the CommonJS build of `@queueless/shared`, which blanked the dev page and failed `vite build`. `vite.config.ts` now aliases the package to its TypeScript source for the browser bundle.

## Known weaker points (by design for the MVP)
- **Single API server.** Rate limits and login throttling are in memory; a second server would not share them (ADR-005). Sockets are a single Socket.IO server with no Redis adapter.
- **Per-IP limits hurt shared networks.** A clinic behind one NAT address shares the 30 writes per minute limit. Configurable with `PUBLIC_WRITE_LIMIT`.
- **A known email can be locked out for 15 minutes** by repeated failed logins (accepted trade-off, D-28).
- **The ticket link is the patient's only credential.** Anyone who gets the link can see and cancel that ticket. It is 256-bit and expires 24 hours after the ticket finishes.
- **Auditor checks consistency, not truth.** It cannot know about a patient who walked away (see `invariant-auditor.md`). Its default window is 7 days.
- **The auditor's read-only guarantee is by construction** (SELECT-only SQL), not enforced by a read-only transaction.
- **Staff JWT is stored in `localStorage`.** Standard for this kind of app but exposed to any XSS; there is no refresh-token flow (8 hour token).
- **Demo accounts are shared and their password is published in the README (decision 2026-11-13).** The demo clinic holds only made-up data, but anyone can sign in, including as Clinic Admin, and change it. Re-run `seed:demo` with a new `DEMO_PASSWORD` to rotate it. Never reuse this password anywhere else.

## Housekeeping
- Git history was rewritten on 2026-11-12 to remove tool attribution from commits; a local backup branch `backup-before-rewrite` still holds the old history.
- Several `docs/` files still describe the first design (for example the socket event names in `api.md`); `api.md` has a dated "Implemented in" section that wins where they differ.
