from typing import Any

from fastapi import APIRouter, Query

from ..integrations import fetch_all_upcoming

router = APIRouter(prefix="/sources", tags=["event sources"])


@router.get("/upcoming")
async def upcoming_events(
    force_refresh: bool = Query(False, description="Bypass the five-minute source cache"),
) -> dict[str, Any]:
    """Merge upcoming events from every configured public source.

    A failure from one provider is reported in `status` without hiding healthy sources.
    """
    return await fetch_all_upcoming(force=force_refresh)
