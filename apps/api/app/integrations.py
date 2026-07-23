"""Live public-source adapters with a stable, source-neutral contract."""
import asyncio
import re
import time
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any, Awaitable, Callable

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "EventBazar/1.0 (+https://eventbazar.example)"
def iso_from_timestamp(value: int | float) -> str:
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def live_event(*, source: str, external_id: str, title: str, starts_at: str,
               ends_at: str | None, category: str, organizer: str, url: str,
               location: str = "Worldwide", prize: str = "Recognition",
               description: str = "", team_size: str = "Solo",
               difficulty: str = "All levels", banner_url: str | None = None,
               tags: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": f"{source}-{external_id}", "source": source, "external_id": external_id,
        "title": title, "starts_at": starts_at, "ends_at": ends_at,
        "registration_deadline": starts_at, "category": category,
        "organizer": organizer, "official_url": url, "location": location,
        "format": "Online" if location.lower() in {"online", "worldwide"} else "Offline",
        "prize": prize or "Recognition", "team_size": team_size,
        "difficulty": difficulty, "description": description or f"Upcoming {category.lower()} event from {organizer}.",
        "banner_url": banner_url, "tags": tags or [source, category],
    }


async def fetch_ctftime(limit: int = 100) -> list[dict[str, Any]]:
    now = int(datetime.now(timezone.utc).timestamp())
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get("https://ctftime.org/api/v1/events/", params={"limit": limit, "start": now})
        response.raise_for_status()
    return [live_event(
        source="ctftime", external_id=str(item["id"]), title=item["title"],
        starts_at=item["start"], ends_at=item.get("finish"), category="CTF",
        organizer=(item.get("organizers") or [{}])[0].get("name", "CTFtime"),
        url=item.get("url") or item.get("ctftime_url"),
        location=item.get("location") or ("Offline" if item.get("onsite") else "Online"),
        prize=re.sub(r"\s+", " ", item.get("prizes") or "Recognition")[:100],
        description=item.get("description") or "Cybersecurity competition listed on CTFtime.",
        team_size="Team", difficulty="All levels", tags=["CTFtime", item.get("format") or "CTF"],
    ) for item in response.json()]


async def fetch_codeforces() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get("https://codeforces.com/api/contest.list", params={"gym": "false"})
        response.raise_for_status()
    return [live_event(
        source="codeforces", external_id=str(item["id"]), title=item["name"],
        starts_at=iso_from_timestamp(item["startTimeSeconds"]),
        ends_at=iso_from_timestamp(item["startTimeSeconds"] + item["durationSeconds"]),
        category="Programming", organizer="Codeforces",
        url=f"https://codeforces.com/contest/{item['id']}", difficulty="Competitive",
        description="Upcoming rated competitive programming contest on Codeforces.",
        tags=["Codeforces", item.get("type", "Contest"), "Algorithms"],
    ) for item in response.json().get("result", []) if item.get("phase") == "BEFORE"]


async def fetch_leetcode() -> list[dict[str, Any]]:
    query = "query { upcomingContests { title titleSlug startTime duration } }"
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.post("https://leetcode.com/graphql", json={"query": query})
        response.raise_for_status()
    contests = response.json().get("data", {}).get("upcomingContests", [])
    return [live_event(
        source="leetcode", external_id=item["titleSlug"], title=item["title"],
        starts_at=iso_from_timestamp(item["startTime"]),
        ends_at=iso_from_timestamp(item["startTime"] + item["duration"]),
        category="Programming", organizer="LeetCode",
        url=f"https://leetcode.com/contest/{item['titleSlug']}", difficulty="All levels",
        description="Upcoming LeetCode weekly or biweekly programming contest.",
        tags=["LeetCode", "Algorithms", "Interview prep"],
    ) for item in contests]


async def fetch_codechef() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get("https://www.codechef.com/api/list/contests/all")
        response.raise_for_status()
    return [live_event(
        source="codechef", external_id=item["contest_code"], title=item["contest_name"],
        starts_at=item["contest_start_date_iso"], ends_at=item.get("contest_end_date_iso"),
        category="Programming", organizer="CodeChef",
        url=f"https://www.codechef.com/{item['contest_code']}", difficulty="All levels",
        description="Upcoming competitive programming event on CodeChef.",
        tags=["CodeChef", "Algorithms", "Contest"],
    ) for item in response.json().get("future_contests", [])]


async def fetch_atcoder() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get("https://atcoder.jp/contests/?lang=en")
        response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    heading = next((node for node in soup.select("h3") if "Upcoming Contests" in node.text), None)
    table = heading.find_next("table") if heading else None
    result = []
    for row in table.select("tbody tr") if table else []:
        cells = row.select("td")
        link = row.select_one('a[href^="/contests/"]')
        time_node = row.select_one("time")
        if len(cells) < 3 or not link or not time_node:
            continue
        start = datetime.strptime(time_node.text.strip(), "%Y-%m-%d %H:%M:%S%z")
        hours, minutes = (int(part) for part in cells[2].text.strip().split(":"))
        slug = link["href"].rsplit("/", 1)[-1]
        rated = cells[3].text.strip() if len(cells) > 3 else "All"
        result.append(live_event(
            source="atcoder", external_id=slug, title=link.text.strip(),
            starts_at=start.isoformat(), ends_at=(start + timedelta(hours=hours, minutes=minutes)).isoformat(),
            category="Programming", organizer="AtCoder", url=f"https://atcoder.jp{link['href']}",
            difficulty="Rated " + rated if rated != "All" else "All levels",
            description="Upcoming algorithmic programming contest on AtCoder.",
            tags=["AtCoder", "Algorithms", "Rated"],
        ))
    return result


async def fetch_devpost() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get("https://devpost.com/api/hackathons", params={"status[]": "upcoming", "page": 1})
        response.raise_for_status()
    now = datetime.now(timezone.utc)
    result = []
    for item in response.json().get("hackathons", []):
        dates = re.search(r"([A-Z][a-z]{2}) (\d{1,2}).*?([A-Z][a-z]{2}) (\d{1,2}), (\d{4})", item.get("submission_period_dates", ""))
        if dates:
            start = datetime.strptime(f"{dates.group(1)} {dates.group(2)} {dates.group(5)}", "%b %d %Y").replace(tzinfo=timezone.utc)
            end = datetime.strptime(f"{dates.group(3)} {dates.group(4)} {dates.group(5)}", "%b %d %Y").replace(tzinfo=timezone.utc)
        else:
            start, end = now + timedelta(days=30), None
        prize = BeautifulSoup(unescape(item.get("prize_amount") or "Recognition"), "html.parser").get_text(" ", strip=True)
        image = item.get("thumbnail_url") or ""
        result.append(live_event(
            source="devpost", external_id=str(item["id"]), title=item["title"],
            starts_at=start.isoformat(), ends_at=end.isoformat() if end else None,
            category="Hackathon", organizer=item.get("organization_name") or "Devpost",
            url=item["url"], location=item.get("displayed_location", {}).get("location", "Online"),
            prize=prize, team_size="Team", difficulty="All levels",
            banner_url=("https:" + image if image.startswith("//") else image) or None,
            description=f"Upcoming hackathon hosted by {item.get('organization_name') or 'the Devpost community'}.",
            tags=[theme["name"] for theme in item.get("themes", [])[:3]] or ["Devpost", "Hackathon"],
        ))
    return result


SOURCES: dict[str, Callable[[], Awaitable[list[dict[str, Any]]]]] = {
    "ctftime": fetch_ctftime, "codeforces": fetch_codeforces, "leetcode": fetch_leetcode,
    "codechef": fetch_codechef, "atcoder": fetch_atcoder, "devpost": fetch_devpost,
}
_cache: dict[str, Any] = {"at": 0.0, "events": [], "status": {}}
_lock = asyncio.Lock()


async def fetch_all_upcoming(force: bool = False) -> dict[str, Any]:
    if not force and _cache["events"] and time.monotonic() - _cache["at"] < 300:
        return {**_cache, "cached": True}
    async with _lock:
        results = await asyncio.gather(*(adapter() for adapter in SOURCES.values()), return_exceptions=True)
        events: list[dict[str, Any]] = []
        status: dict[str, dict[str, Any]] = {}
        for name, result in zip(SOURCES, results, strict=True):
            if isinstance(result, Exception):
                status[name] = {"ok": False, "count": 0, "error": str(result)[:180]}
            else:
                events.extend(result)
                status[name] = {"ok": True, "count": len(result), "error": None}
        events.sort(key=lambda item: item["starts_at"])
        if events:
            _cache.update(at=time.monotonic(), events=events, status=status)
        return {"events": events or _cache["events"], "status": status, "cached": not bool(events), "updated_at": datetime.now(timezone.utc).isoformat()}
