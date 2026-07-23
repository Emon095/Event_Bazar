from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Category, Event, EventStatus, Organizer


def seed_database(db: Session) -> None:
    if db.scalar(select(Category.id).limit(1)):
        return
    categories = [Category(name=name, slug=slug) for name, slug in [
        ("CTF", "ctf"), ("Programming", "programming"), ("Hackathon", "hackathon"),
        ("Workshop", "workshop"), ("Career", "career")]]
    organizer = Organizer(name="Event Bazar Community", verified=True, website="https://eventbazar.example")
    db.add_all([*categories, organizer])
    db.flush()
    now = datetime.now(timezone.utc)
    samples = [
        ("cipherstorm-ctf-2026", "CipherStorm CTF 2026", categories[0], 16, "$12,000", "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1400&q=85"),
        ("build-for-bengal", "Build for Bengal Hackathon", categories[2], 42, "৳1M", "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=85"),
        ("agentic-ai-workshop", "Agentic AI: From Prompt to Product", categories[3], 9, "Free", "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=85"),
    ]
    for slug, title, category, days, prize, banner in samples:
        db.add(Event(slug=slug, title=title, short_description="Discover, learn, and compete with the global technology community.", description="A community-powered technology event with hands-on learning, collaboration, and meaningful challenges for participants of all levels.", category_id=category.id, organizer_id=organizer.id, banner_url=banner, starts_at=now+timedelta(days=days), registration_deadline=now+timedelta(days=days-2), prize=prize, team_size="1–4", difficulty="All levels", format="Online", location="Worldwide", status=EventStatus.published, is_featured=True))
    db.commit()
