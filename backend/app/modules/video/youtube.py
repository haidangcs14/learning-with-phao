import re
from urllib.parse import parse_qs, urlparse

ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def parse_youtube_id(url: str) -> str | None:
    """Accepts youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID (and a bare 11-character ID)."""
    url = (url or "").strip()
    if ID.match(url):
        return url
    try:
        u = urlparse(url if "://" in url else f"https://{url}")
    except ValueError:
        return None
    host = (u.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    if host == "youtu.be":
        cand = u.path.strip("/").split("/")[0]
    elif host in ("youtube.com", "youtube-nocookie.com", "music.youtube.com"):
        parts = [p for p in u.path.split("/") if p]
        cand = parse_qs(u.query).get("v", [""])[0] if u.path == "/watch" else (parts[1] if len(parts) >= 2 and parts[0] in ("embed", "shorts", "live", "v") else "")
    else:
        return None
    return cand if ID.match(cand or "") else None
