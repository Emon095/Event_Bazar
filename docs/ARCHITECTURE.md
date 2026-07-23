# Event Bazar architecture

```mermaid
flowchart LR
  A[Next.js PWA] -->|REST / JWT| B[FastAPI]
  K[Android / Compose] -->|REST / JWT| B
  B --> P[(PostgreSQL)]
  B --> R[(Redis / jobs)]
  J[Sync workers] --> C[CTFtime]
  J --> F[Contest feeds]
  J --> H[Hackathon feeds]
  J --> B
  B --> M[Firebase Cloud Messaging]
  B --> O[Object storage]
```

The web and Android clients share versioned API contracts. FastAPI owns authorization,
moderation, event state and notification preferences. Background workers normalize and
upsert public-source events by `(source, external_id)`. PostgreSQL is authoritative;
Redis, object storage and FCM are replaceable infrastructure adapters.

## Data model

```mermaid
erDiagram
  USER ||--o{ EVENT : creates
  CATEGORY ||--o{ EVENT : classifies
  ORGANIZER ||--o{ EVENT : hosts
  EVENT ||--o{ EVENT_IMAGE : has
  EVENT ||--o{ COMMENT : discusses
  USER ||--o{ COMMENT : writes
  COMMENT ||--o{ COMMENT : replies
  USER ||--o{ INTEREST : marks
  EVENT ||--o{ INTEREST : receives
  USER ||--o{ SAVED_EVENT : saves
  EVENT ||--o{ SAVED_EVENT : saved
  EVENT }o--o{ SPONSOR : supported_by
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ REPORT : submits
```

## Trust boundaries

- Public submissions always enter `pending`; only moderation promotes them.
- OAuth tokens and passwords never reach the clients' persistent application state.
- External HTML is normalized as plain text/validated Markdown before persistence.
- Imported URLs are validated, outbound fetches use explicit source allowlists, and
  scheduled jobs are isolated from request workers.

