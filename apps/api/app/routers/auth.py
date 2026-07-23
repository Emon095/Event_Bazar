from datetime import datetime, timedelta, timezone
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import PasswordCredential, User, UserProfile
from ..schemas import AccountCreate, AccountLogin, AccountOut, ProfileOut, ProfileUpdate

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()
passwords = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def set_session_cookie(response: Response, user: User) -> None:
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    token = jwt.encode({"sub": user.id, "email": user.email, "admin": user.is_admin, "exp": expires}, settings.secret_key, algorithm="HS256")
    response.set_cookie("event_bazar_session", token, max_age=604800, httponly=True, secure=settings.environment == "production", samesite="lax")


def current_user(event_bazar_session: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> User:
    if not event_bazar_session:
        raise HTTPException(status_code=401, detail="Please sign in")
    try:
        payload = jwt.decode(event_bazar_session, settings.secret_key, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Session is invalid or expired")
    user = db.get(User, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


def profile_response(user: User, profile: UserProfile | None) -> ProfileOut:
    return ProfileOut(
        id=user.id, name=user.name, email=user.email, avatar_url=user.avatar_url,
        bio=user.bio, institution=profile.institution if profile else None,
        website_url=profile.website_url if profile else None,
        location=profile.location if profile else None, skills=profile.skills if profile else None,
        is_admin=user.is_admin,
    )


@router.get("/me", response_model=ProfileOut)
def get_profile(user: User = Depends(current_user), db: Session = Depends(get_db)) -> ProfileOut:
    return profile_response(user, db.get(UserProfile, user.id))


@router.patch("/me", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ProfileOut:
    user.name = payload.name.strip()
    user.avatar_url = str(payload.avatar_url) if payload.avatar_url else None
    user.bio = payload.bio.strip() if payload.bio else None
    profile = db.get(UserProfile, user.id)
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    profile.institution = payload.institution.strip() if payload.institution else None
    profile.website_url = str(payload.website_url) if payload.website_url else None
    profile.location = payload.location.strip() if payload.location else None
    profile.skills = payload.skills.strip() if payload.skills else None
    db.commit()
    return profile_response(user, profile)


@router.post("/register", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def register(payload: AccountCreate, response: Response, db: Session = Depends(get_db)) -> User:
    email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(email=email, name=payload.name.strip())
    db.add(user)
    db.flush()
    db.add(PasswordCredential(user_id=user.id, password_hash=passwords.hash(payload.password)))
    db.commit()
    db.refresh(user)
    set_session_cookie(response, user)
    return user


@router.post("/login", response_model=AccountOut)
def email_login(payload: AccountLogin, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    credential = db.get(PasswordCredential, user.id) if user else None
    if not user or not credential or not passwords.verify(payload.password, credential.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    set_session_cookie(response, user)
    return user


@router.get("/google/login")
def google_login() -> RedirectResponse:
    if not settings.google_client_id or not settings.google_client_secret:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_not_configured")
    state = secrets.token_urlsafe(32)
    query = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    })
    response = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")
    response.set_cookie("google_oauth_state", state, max_age=600, httponly=True, secure=settings.environment == "production", samesite="lax")
    return response


@router.get("/google/callback")
async def google_callback(code: str, state: str, request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    if not secrets.compare_digest(state, request.cookies.get("google_oauth_state", "")):
        return RedirectResponse(f"{settings.frontend_url}/login?error=invalid_oauth_state")
    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri, "grant_type": "authorization_code",
        })
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]
        user_response = await client.get("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {access_token}"})
        user_response.raise_for_status()
    profile = user_response.json()
    user = db.scalar(select(User).where(User.email == profile["email"]))
    if not user:
        user = User(email=profile["email"], name=profile.get("name") or profile["email"].split("@")[0], avatar_url=profile.get("picture"))
        db.add(user)
        db.commit()
        db.refresh(user)
    response = RedirectResponse(f"{settings.frontend_url}/?login=success")
    response.delete_cookie("google_oauth_state")
    set_session_cookie(response, user)
    return response
