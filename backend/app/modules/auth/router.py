import hmac
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Response
from fastapi.responses import RedirectResponse

from app.common.exceptions import AppException
from app.common.responses import ApiResponse
from app.core.config import get_settings
from app.core.security import create_token, decode_token
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.auth.mailer import send_email
from app.modules.auth.oauth import PROVIDERS, authorize_url, fetch_profile, is_configured
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.auth.schema import ChangePasswordIn, ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn
from app.modules.auth.service import AuthService
from app.modules.users.repository import UserRepository
from app.modules.users.schema import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
REFRESH_COOKIE = "refresh_token"
NONCE_COOKIE = "oauth_nonce"
COOKIE_PATH = "/api/v1/auth"


def get_auth_service(db=Depends(db_dependency)) -> AuthService:
    return AuthService(UserRepository(db), RefreshTokenRepository(db))


Service = Annotated[AuthService, Depends(get_auth_service)]


def _secure() -> bool:
    return get_settings().app_env != "development"


def _set_refresh_cookie(response: Response, token: str, remember: bool = True) -> None:
    s = get_settings()
    # remember=False => no max_age: a session cookie that disappears when the browser closes
    response.set_cookie(REFRESH_COOKIE, token, httponly=True, secure=_secure(), samesite="lax",
                        max_age=s.refresh_token_expire_days * 86400 if remember else None, path=COOKIE_PATH)


def _session(user: dict, access: str) -> dict:
    return {"access_token": access, "token_type": "bearer", "user": UserOut(**user)}


@router.post("/register", status_code=201, response_model=ApiResponse)
async def register(data: RegisterIn, service: Service):
    return ApiResponse(data=UserOut(**await service.register(data)), message="Registered")


@router.post("/login", response_model=ApiResponse)
async def login(data: LoginIn, response: Response, service: Service):
    user = await service.authenticate(data)
    access, refresh = await service.start_session(user["id"], data.remember)
    _set_refresh_cookie(response, refresh, data.remember)
    return ApiResponse(data=_session(user, access))


@router.post("/refresh", response_model=ApiResponse)
async def refresh(response: Response, service: Service, refresh_token: Annotated[str | None, Cookie()] = None):
    user, access, new_refresh, remember = await service.refresh(refresh_token)
    _set_refresh_cookie(response, new_refresh, remember)
    return ApiResponse(data=_session(user, access))


@router.post("/logout", response_model=ApiResponse)
async def logout(response: Response, service: Service, refresh_token: Annotated[str | None, Cookie()] = None):
    await service.logout(refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
    return ApiResponse(message="Logged out")


@router.get("/me", response_model=ApiResponse)
async def me(user: CurrentUser):
    return ApiResponse(data=UserOut(**user))


@router.post("/change-password", response_model=ApiResponse)
async def change_password(data: ChangePasswordIn, user: CurrentUser, service: Service):
    await service.change_password(user, data)
    return ApiResponse(message="Password updated")


# ---------- forgot / reset password ----------
@router.post("/forgot-password", response_model=ApiResponse)
async def forgot_password(data: ForgotPasswordIn, background: BackgroundTasks, service: Service):
    link = await service.request_reset(data.email)
    if link:  # the email is sent in the background so the response time doesn't reveal whether the account exists
        minutes = get_settings().password_reset_minutes
        background.add_task(send_email, data.email, "Reset your password",
                            f"Open this link to choose a new password (valid for {minutes} minutes):\n{link}\n\n"
                            "If you did not request this, you can ignore this email.")
    return ApiResponse(message="If the email exists, a reset link has been sent")  # same answer either way


@router.post("/reset-password", response_model=ApiResponse)
async def reset_password(data: ResetPasswordIn, service: Service):
    await service.reset_password(data.token, data.new_password)
    return ApiResponse(message="Password updated")


# ---------- social login ----------
def _fail(code: str) -> RedirectResponse:
    return RedirectResponse(f"{get_settings().frontend_url.rstrip('/')}/login?error={code}", status_code=302)


@router.get("/{provider}/login", include_in_schema=False)
async def oauth_login(provider: str):
    if not is_configured(provider):
        return _fail("oauth_not_configured")
    nonce = secrets.token_urlsafe(16)  # binds the flow to this browser (CSRF protection)
    state = create_token(nonce, "oauth_state", timedelta(minutes=10), provider=provider)
    resp = RedirectResponse(authorize_url(provider, state), status_code=302)
    resp.set_cookie(NONCE_COOKIE, nonce, httponly=True, secure=_secure(), samesite="lax", max_age=600, path=COOKIE_PATH)
    return resp


@router.get("/{provider}/callback", include_in_schema=False)
async def oauth_callback(provider: str, service: Service, code: str | None = None, state: str | None = None,
                         error: str | None = None, oauth_nonce: Annotated[str | None, Cookie()] = None):
    if provider not in PROVIDERS or not is_configured(provider):
        return _fail("oauth_not_configured")
    if error or not code or not state:
        return _fail("oauth_failed")
    payload = decode_token(state, "oauth_state")
    if not payload or payload.get("provider") != provider or not oauth_nonce or not hmac.compare_digest(str(payload["sub"]), oauth_nonce):
        return _fail("oauth_state")
    profile = await fetch_profile(provider, code)
    if not profile:
        return _fail("oauth_failed")
    try:
        user = await service.oauth_login(provider, profile)
    except AppException as exc:
        return _fail({"OAUTH_EMAIL_TAKEN": "oauth_email_taken", "OAUTH_NO_EMAIL": "oauth_no_email"}.get(exc.error_code, "oauth_failed"))
    _, refresh_token = await service.start_session(user["id"], True)
    resp = RedirectResponse(f"{get_settings().frontend_url.rstrip('/')}/oauth/callback", status_code=302)
    _set_refresh_cookie(resp, refresh_token, True)  # the frontend then calls /auth/refresh to get its access token
    resp.delete_cookie(NONCE_COOKIE, path=COOKIE_PATH)
    return resp
