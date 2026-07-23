"""Export all public event sources for static hosts such as GitHub Pages."""

import argparse
import asyncio
import json
from pathlib import Path

from app.integrations import fetch_all_upcoming


async def export(destination: Path) -> None:
    payload = await fetch_all_upcoming(force=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Exported {len(payload['events'])} events to {destination}: "
        + ", ".join(
            f"{name}={status['count']}" for name, status in payload["status"].items()
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    asyncio.run(export(args.destination))
