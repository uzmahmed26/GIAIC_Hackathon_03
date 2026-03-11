from fastapi import Request
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger()


class LearnFlowError(Exception):
    def __init__(self, message: str, status_code: int = 500, detail: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or {}
        super().__init__(message)


class LLMError(LearnFlowError):
    def __init__(self, message: str = "LLM call failed"):
        super().__init__(message, status_code=502)


class DatabaseError(LearnFlowError):
    def __init__(self, message: str = "Database error"):
        super().__init__(message, status_code=503)


class ValidationError(LearnFlowError):
    def __init__(self, message: str):
        super().__init__(message, status_code=422)


async def learnflow_exception_handler(request: Request, exc: LearnFlowError) -> JSONResponse:
    logger.error("learnflow_error", path=request.url.path, message=exc.message, status=exc.status_code)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "detail": exc.detail, "path": str(request.url.path)},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_error", path=request.url.path, error=str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "path": str(request.url.path)},
    )
