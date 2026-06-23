from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.api.routes import auth, jobs, cv, filters
from app.db.init_db import init_db
from app.core.config import get_settings

settings = get_settings()

DESCRIPTION = """
## JobRadar API

Self-hosted multi-user job aggregator with CV-based matching.

### How it works
1. **Register** a user account and **log in** — a JWT is stored in an `access_token` httpOnly cookie.
2. **Upload your CV** (PDF) — it is parsed and summarised for matching.
3. **Set your filters** — role titles, experience level, location, tech stack.
4. **Trigger the pipeline** (`POST /api/jobs/trigger`) or wait for the daily Celery Beat run.
5. Jobs are fetched from **8 remote platforms**, deduplicated, filtered against your preferences, and stored.
6. **Match jobs** against your CV (`POST /api/jobs/{id}/match`) to get a 0–100 score with strengths, gaps, and suggestions.

### Authentication
All endpoints except `/api/auth/login` and `/api/auth/register` require a valid session cookie.
Login via `POST /api/auth/login` — the response sets an `access_token` httpOnly cookie (30-minute expiry).

### Data isolation
Every user's jobs, CVs, scores, statuses, and filters are fully isolated.
Users cannot see or affect each other's data.
"""

TAGS_METADATA = [
    {
        "name": "auth",
        "description": "Register, log in, and log out. Login sets a JWT in an httpOnly cookie valid for 30 minutes.",
    },
    {
        "name": "jobs",
        "description": (
            "Browse, filter, score, and manage job listings. "
            "All data is scoped to the authenticated user. "
            "Jobs are fetched from 8 platforms: We Work Remotely, Himalayas, Arc.dev, RemoteOK, "
            "Working Nomads, Empllo, Remotive, and Arbeitnow."
        ),
    },
    {
        "name": "cv",
        "description": (
            "Upload and manage CV versions (PDF, max 10 MB). "
            "The active CV is used when matching jobs. "
            "Magic-bytes validated; filename sanitised against path traversal."
        ),
    },
    {
        "name": "filters",
        "description": (
            "Configure pre-filter preferences applied at pipeline time. "
            "Jobs that don't match are discarded before storage."
        ),
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="JobRadar API",
    version="1.0.0",
    description=DESCRIPTION,
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=TAGS_METADATA,
    contact={
        "name": "Nayeem Hasan",
        "url": "https://nayeemhasan.xyz",
    },
    license_info={
        "name": "Private — self-hosted",
    },
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=TAGS_METADATA,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Paste the `access_token` returned by `POST /api/auth/login`.",
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation.setdefault("security", [{"BearerAuth": []}])
    # Login and register don't require auth
    for no_auth in ["/api/auth/login", "/api/auth/register", "/api/health"]:
        if no_auth in schema.get("paths", {}):
            for operation in schema["paths"][no_auth].values():
                operation["security"] = []
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(cv.router, prefix="/api")
app.include_router(filters.router, prefix="/api")


@app.get("/api/health", tags=["health"], summary="Health check")
def health():
    """Returns the current environment. Used by Docker healthchecks and uptime monitors."""
    return {"status": "ok", "env": settings.APP_ENV}
