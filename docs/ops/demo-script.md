# Demo Script (2–3 minutes)

Status: Final v1.0 · Last updated: 2026-11-05

Layout: split screen — staff screen (left), TV (top right), phone/patient page (bottom right). Use the seeded demo tenant. Say only what is true and measured.

| Time | Action | Say |
|---|---|---|
| 0:00 | Show the 3 views | "Queueless: patients wait anywhere, staff run the queue, the TV shows who's next." |
| 0:15 | Patient joins on phone (name + consent) | "Name and phone only. Never symptoms — Data Privacy Act." |
| 0:30 | Issue 3–4 more tickets | "Each gets a unique number per service point per day." |
| 0:45 | Staff clicks **Call next** | "TV and patient page update without refresh." |
| 1:00 | Double-click **Call next** fast | "Idempotency key: second click doesn't skip anyone." |
| 1:15 | Two staff windows call next together | "SKIP LOCKED: two staff, two different patients." |
| 1:35 | Show k6 result: 200 bookings, 1 slot → 1 success | Read the **actual recorded numbers**. |
| 1:55 | Kill the API container on camera | "State lives in Postgres, not memory." |
| 2:05 | Restart; screens reconnect and refetch | "Queue is intact." |
| 2:25 | Show event log / README validation table | "Everything here is measured; real clinic validation is a next step." |
| 2:40 | Close | Link to repo and live demo. |

## Prep checklist
- [ ] Seed fresh data; reset between takes
- [ ] Three browser windows sized and arranged
- [ ] k6 results ready on screen
- [ ] Docker command to kill/restart the API ready
- [ ] No secrets visible in terminal or screen
