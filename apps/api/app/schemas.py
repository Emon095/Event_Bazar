from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator
from .models import EventStatus


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str


class OrganizerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    logo_url: str | None
    website: str | None
    verified: bool


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    title: str
    short_description: str
    description: str
    banner_url: str | None
    starts_at: datetime
    ends_at: datetime | None
    registration_deadline: datetime
    registration_url: str | None
    website_url: str | None
    discord_url: str | None
    prize: str
    team_size: str
    difficulty: str
    format: str
    location: str
    is_featured: bool
    source: str
    status: EventStatus
    category: CategoryOut
    organizer: OrganizerOut


class EventCreate(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180)
    short_description: str = Field(min_length=20, max_length=400)
    description: str = Field(min_length=50, max_length=30_000)
    category_slug: str = Field(pattern=r"^[a-z0-9-]+$", max_length=60)
    organizer_name: str = Field(min_length=2, max_length=150)
    banner_url: HttpUrl | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    registration_deadline: datetime
    registration_url: HttpUrl | None = None
    website_url: HttpUrl | None = None
    discord_url: HttpUrl | None = None
    prize: str = Field(default="Free", max_length=100)
    team_size: str = Field(default="Solo", max_length=30)
    difficulty: str = Field(default="All levels", max_length=40)
    format: str = Field(default="Online", pattern="^(Online|Offline|Hybrid)$")
    location: str = Field(default="Worldwide", max_length=180)

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.registration_deadline >= self.starts_at:
            raise ValueError("Registration deadline must be before the event start")
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("Event end must be after the event start")
        return self


class EventModeration(BaseModel):
    status: EventStatus

    @model_validator(mode="after")
    def only_review_states(self):
        if self.status == EventStatus.pending:
            raise ValueError("Use published or rejected when reviewing an event")
        return self


class AccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320)
    password: str = Field(min_length=8, max_length=72)


class AccountLogin(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320)
    password: str = Field(min_length=8, max_length=72)


class AccountOut(BaseModel):
    id: str
    name: str
    email: str
    is_admin: bool


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    institution: str | None = Field(default=None, max_length=180)
    avatar_url: HttpUrl | None = None
    bio: str | None = Field(default=None, max_length=1000)
    website_url: HttpUrl | None = None
    location: str | None = Field(default=None, max_length=180)
    skills: str | None = Field(default=None, max_length=500)


class ProfileOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: str | None
    bio: str | None
    institution: str | None
    website_url: str | None
    location: str | None
    skills: str | None
    is_admin: bool


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int


class EventPage(BaseModel):
    items: list[EventOut]
    meta: PageMeta
