import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("app.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs method, path, status, duration. Never logs headers/body (secrets)."""

    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s -> %s (%.1fms)", request.method, request.url.path, response.status_code, ms
        )
        return response
