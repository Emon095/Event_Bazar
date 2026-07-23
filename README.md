# Event Bazar

A premium, community-powered discovery platform for CTFs, programming contests,
hackathons, workshops and technology career events.

The interface uses the supplied Event Bazar bag/calendar identity and its blue,
coral, navy, violet, green and amber brand palette across the PWA shell and icons.

This repository is **Milestone 1**: the responsive PWA experience, a normalized
FastAPI data foundation, six live event-source adapters, containerized local
infrastructure and CI. Authentication, moderation UI, scheduled sync workers, FCM,
uploads and the native Android client are deliberately tracked as later milestones.

## Run locally

Prerequisites: Node 22+, Python 3.11+.

```bash
cd apps/web
npm install
npm run dev
```

In a second terminal:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload
```

Open the production application at `https://emon095.github.io`.
The API defaults to SQLite for development. Copy each `.env.example` when using
PostgreSQL or a different API origin.

Google sign-in is managed by Supabase. The authorized Google OAuth callback is
`https://jpnhxknzezgizwoqjtcb.supabase.co/auth/v1/callback`. Supabase redirects
successful authentication back to `https://emon095.github.io`.

Community submissions are published immediately after server-side validation.

Alternatively, run the full PostgreSQL stack:

```bash
docker compose up --build
```

## Repository map

```text
apps/web/        Next.js 15, TypeScript, React Query, Framer Motion, PWA manifest
apps/api/        FastAPI, SQLAlchemy, source adapters and API tests
docs/            Architecture and normalized ER model
.github/         Web/API continuous integration
```

## API

- `GET /health`
- `GET /api/v1/events?page=1&page_size=12&category=ctf&q=security`
- `GET /api/v1/events/{slug}`
- `GET /api/v1/sources/upcoming` (live merged CTFtime, Codeforces, LeetCode,
  CodeChef, AtCoder and Devpost feed; five-minute resilient cache)
- `POST /api/v1/events` (creates a pending moderation submission)

## Delivery roadmap

1. **Foundation (this milestone):** live multi-source discovery feed, event detail,
   responsive design, themes, PWA metadata, events API, schema, adapters, tests and containers.
2. **Identity and community:** Google/GitHub/email auth, profiles, comments/reactions,
   save/interest persistence, uploads and moderation dashboard.
3. **Automation:** persistent scheduled imports, deduplication, Redis workers, FCM reminders,
   analytics and reporting.
4. **Native Android:** Compose/MVVM client sharing the stable v1 API, Room offline
   cache, Paging 3, Hilt, deep links and Play-ready release automation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system and ER diagrams.
