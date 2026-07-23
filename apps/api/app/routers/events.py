import math

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Category, Event, EventStatus, Organizer
from ..config import get_settings
from ..schemas import EventCreate, EventModeration, EventOut, EventPage, PageMeta

router = APIRouter(prefix="/events", tags=["events"])


def require_admin(x_admin_key: str = Header(default="")) -> None:
    expected = get_settings().admin_key
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="A valid admin key is required")


@router.get("", response_model=EventPage)
def list_events(
    page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=50),
    q: str | None = Query(None, max_length=100), category: str | None = None,
    format: str | None = Query(None, pattern="^(Online|Offline|Hybrid)$"),
    featured: bool | None = None, db: Session = Depends(get_db),
) -> EventPage:
    filters = [Event.status == EventStatus.published]
    if q:
        term = f"%{q.strip()}%"
        filters.append(or_(Event.title.ilike(term), Event.short_description.ilike(term), Event.location.ilike(term)))
    if category:
        filters.append(Event.category.has(Category.slug == category.lower()))
    if format:
        filters.append(Event.format == format)
    if featured is not None:
        filters.append(Event.is_featured == featured)
    total = db.scalar(select(func.count()).select_from(Event).where(*filters)) or 0
    statement = (select(Event).options(selectinload(Event.category), selectinload(Event.organizer))
                 .where(*filters).order_by(Event.is_featured.desc(), Event.starts_at)
                 .offset((page - 1) * page_size).limit(page_size))
    items = list(db.scalars(statement).all())
    return EventPage(items=items, meta=PageMeta(page=page, page_size=page_size, total=total, pages=math.ceil(total/page_size) if total else 0))


@router.get("/admin/pending", response_model=list[EventOut], dependencies=[Depends(require_admin)])
def pending_events(db: Session = Depends(get_db)) -> list[Event]:
    statement = (
        select(Event)
        .options(selectinload(Event.category), selectinload(Event.organizer))
        .where(Event.status == EventStatus.pending)
        .order_by(Event.created_at.desc())
    )
    return list(db.scalars(statement).all())


@router.get("/admin/community", response_model=list[EventOut], dependencies=[Depends(require_admin)])
def community_events_for_admin(db: Session = Depends(get_db)) -> list[Event]:
    statement = (
        select(Event)
        .options(selectinload(Event.category), selectinload(Event.organizer))
        .where(Event.status == EventStatus.published)
        .order_by(Event.created_at.desc())
    )
    return list(db.scalars(statement).all())


@router.patch("/admin/{event_id}", response_model=EventOut, dependencies=[Depends(require_admin)])
def moderate_event(event_id: str, payload: EventModeration, db: Session = Depends(get_db)) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = payload.status
    db.commit()
    return db.scalar(select(Event).options(selectinload(Event.category), selectinload(Event.organizer)).where(Event.id == event.id))


@router.delete("/admin/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_event(event_id: str, db: Session = Depends(get_db)) -> None:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()


@router.get("/{slug}", response_model=EventOut)
def get_event(slug: str, db: Session = Depends(get_db)) -> Event:
    event = db.scalar(select(Event).options(selectinload(Event.category), selectinload(Event.organizer)).where(Event.slug == slug, Event.status == EventStatus.published))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db)) -> Event:
    if db.scalar(select(Event.id).where(Event.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Slug already exists")
    category = db.scalar(select(Category).where(Category.slug == payload.category_slug))
    if not category:
        raise HTTPException(status_code=422, detail="Unknown event category")
    organizer = db.scalar(select(Organizer).where(Organizer.name == payload.organizer_name))
    if not organizer:
        organizer = Organizer(name=payload.organizer_name)
        db.add(organizer)
        db.flush()
    values = payload.model_dump(exclude={"category_slug", "organizer_name"})
    for field in ("banner_url", "registration_url", "website_url", "discord_url"):
        if values.get(field) is not None:
            values[field] = str(values[field])
    # Existing PostgreSQL deployments have a NOT NULL banner_url column.
    # An empty string preserves compatibility and is rendered as a banner-free card.
    values["banner_url"] = values.get("banner_url") or ""
    event = Event(**values, category_id=category.id, organizer_id=organizer.id, status=EventStatus.published)
    db.add(event)
    db.commit()
    db.refresh(event)
    return db.scalar(select(Event).options(selectinload(Event.category), selectinload(Event.organizer)).where(Event.id == event.id))
