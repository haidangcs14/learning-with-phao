import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    def __init__(self, status_code: int, error_code: str, message: str):
        self.status_code, self.error_code, self.message = status_code, error_code, message


class NotFoundError(AppException):
    def __init__(self, error_code: str = "NOT_FOUND", message: str = "Not found"):
        super().__init__(404, error_code, message)


def _body(message: str, code: str, details=None) -> dict:
    body = {"success": False, "message": message, "error_code": code}
    if details is not None:
        body["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def _app(_: Request, exc: AppException):
        return JSONResponse(_body(exc.message, exc.error_code), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        return JSONResponse(_body("Validation error", "VALIDATION_ERROR", details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            _body(str(exc.detail), f"HTTP_{exc.status_code}"), status_code=exc.status_code
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        logging.getLogger("app").exception("Unhandled error", exc_info=exc)
        return JSONResponse(_body("Internal server error", "INTERNAL_ERROR"), status_code=500)
