from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.routers import sources


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_event_feed_and_filter() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/events", params={"category": "ctf"})
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] >= 1
    assert all(event["category"]["slug"] == "ctf" for event in body["items"])


def test_unknown_event_is_404() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/events/does-not-exist")
    assert response.status_code == 404


def test_live_source_endpoint_isolates_provider_payload(monkeypatch) -> None:
    async def fake_upcoming(force: bool = False):
        return {"events": [{"id": "codeforces-1", "title": "Round 1"}], "status": {"codeforces": {"ok": True, "count": 1}}, "cached": False}

    monkeypatch.setattr(sources, "fetch_all_upcoming", fake_upcoming)
    with TestClient(app) as client:
        response = client.get("/api/v1/sources/upcoming")
    assert response.status_code == 200
    assert response.json()["events"][0]["id"] == "codeforces-1"


def test_create_event_is_published_immediately() -> None:
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Community Demo Day",
        "slug": f"community-demo-{uuid4().hex}",
        "short_description": "A community demo day for useful technology projects.",
        "description": "Meet local builders, see practical product demonstrations, and connect with teams creating useful technology for their communities.",
        "category_slug": "hackathon",
        "organizer_name": "Test Community Organizer",
        "banner_url": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
        "starts_at": (now + timedelta(days=10)).isoformat(),
        "registration_deadline": (now + timedelta(days=8)).isoformat(),
        "format": "Hybrid",
        "location": "Dhaka + Online",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201
    assert response.json()["organizer"]["name"] == "Test Community Organizer"
    assert response.json()["status"] == "published"


def test_google_login_returns_to_login_when_not_configured() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/google/login", follow_redirects=False)
    assert response.status_code == 307
    assert "google_not_configured" in response.headers["location"]
