# App Flow

Status: Final v1.0 · Last updated: 2026-11-05

## Screens
| Screen | Route | Who | Stories |
|---|---|---|---|
| Login | `/login` | Staff, Admins | US-4 |
| Super Admin: tenants | `/admin/tenants` | Super Admin | US-1 |
| Clinic Admin: staff | `/clinic/staff` | Clinic Admin | US-2 |
| Clinic Admin: service points & slots | `/clinic/service-points` | Clinic Admin | US-3, US-8 |
| Staff queue | `/staff/:servicePointId` | Staff | US-9..US-14 |
| TV display | `/tv/:servicePointId` | Public | US-16 |
| Join queue | `/c/:tenantSlug/:servicePointCode` | Patient | US-5 |
| Book slot | `/c/:tenantSlug/book` | Patient | US-8 |
| My ticket | `/t/:token` | Patient | US-6, US-7 |

## Flow 1: Walk-in patient
```mermaid
flowchart LR
  A[Scan QR / open link] --> B[Join queue page]
  B --> C{Name + consent?}
  C -- no --> B
  C -- yes --> D[POST ticket]
  D --> E[My ticket page /t/token]
  E --> F[Live status: ahead count]
  F --> G{Called?}
  G -- yes --> H[Screen shows CALLED, go to desk]
  F --> I[Cancel]
```

## Flow 2: Staff serving
```mermaid
flowchart LR
  L[Login] --> Q[Staff queue screen]
  Q --> N[Call next]
  N --> C[Ticket CALLED]
  C --> S[Start]
  C --> X[No-show]
  C --> K[Skip]
  S --> D[Complete -> SERVED]
  D --> N
  X --> N
  K --> N
```

## Flow 3: Booking
```mermaid
flowchart LR
  A[Book page] --> B[Pick slot]
  B --> C[Name + consent]
  C --> D[POST booking]
  D -- success --> E[Ticket with slot time]
  D -- SLOT_FULL --> B
```

## Flow 4: Real-time
```mermaid
sequenceDiagram
  participant Staff
  participant API
  participant DB
  participant TV
  participant Patient
  Staff->>API: POST call-next (Idempotency-Key)
  API->>DB: tx: lock ticket, update, insert event
  DB-->>API: commit
  API-->>Staff: 200 ticket
  API--)TV: socket: queue.updated
  API--)Patient: socket: ticket.updated
```

## UI rules
- Staff screen has big targets and keyboard shortcut (Space = call next). Button disables while a request is in flight and reuses the same idempotency key on retry.
- TV shows ticket numbers only, never names or phones.
- Patient page works on slow mobile: small bundle, no heavy assets, falls back to polling if the socket drops.
- Staff screen shows a "reconnecting" banner and refetches (TanStack Query) after reconnect.
