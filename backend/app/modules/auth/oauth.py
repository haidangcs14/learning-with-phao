"""Google / Facebook OAuth 2.0 (authorization-code flow). Secrets stay on the server."""
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings

PROVIDERS = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "userinfo": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
    },
    "facebook": {
        "authorize": "https://www.facebook.com/dialog/oauth",
        "token": "https://graph.facebook.com/oauth/access_token",
        "userinfo": "https://graph.facebook.com/me",
        "scope": "email,public_profile",
    },
}


def _creds(provider: str) -> tuple[str, str]:
    s = get_settings()
    return (s.google_client_id, s.google_client_secret) if provider == "google" else (s.facebook_client_id, s.facebook_client_secret)


def is_configured(provider: str) -> bool:
    return provider in PROVIDERS and all(_creds(provider))


def redirect_uri(provider: str) -> str:
    return f"{get_settings().backend_url.rstrip('/')}/api/v1/auth/{provider}/callback"


def authorize_url(provider: str, state: str) -> str:
    cid, _ = _creds(provider)
    q = {"client_id": cid, "redirect_uri": redirect_uri(provider), "response_type": "code",
         "scope": PROVIDERS[provider]["scope"], "state": state}
    return f"{PROVIDERS[provider]['authorize']}?{urlencode(q)}"


async def fetch_profile(provider: str, code: str) -> dict | None:
    """Exchange the code for a token and read the profile. Returns None on any failure."""
    cfg, (cid, secret) = PROVIDERS[provider], _creds(provider)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            data = {"code": code, "client_id": cid, "client_secret": secret, "redirect_uri": redirect_uri(provider)}
            if provider == "google":
                tok = await client.post(cfg["token"], data={**data, "grant_type": "authorization_code"})
                tok.raise_for_status()
                access = tok.json()["access_token"]
                me = await client.get(cfg["userinfo"], headers={"Authorization": f"Bearer {access}"})
                me.raise_for_status()
                u = me.json()
                return {"id": str(u["sub"]), "email": u.get("email"), "email_verified": bool(u.get("email_verified")),
                        "name": u.get("name", ""), "avatar": u.get("picture", "")}
            tok = await client.get(cfg["token"], params=data)
            tok.raise_for_status()
            access = tok.json()["access_token"]
            me = await client.get(cfg["userinfo"], params={"fields": "id,name,email,picture.width(200)", "access_token": access})
            me.raise_for_status()
            u = me.json()
            avatar = (u.get("picture") or {}).get("data", {}).get("url", "")
            # Facebook does not say whether the email is verified => never used to link existing accounts
            return {"id": str(u["id"]), "email": u.get("email"), "email_verified": False,
                    "name": u.get("name", ""), "avatar": avatar}
    except (httpx.HTTPError, KeyError, ValueError):
        return None
