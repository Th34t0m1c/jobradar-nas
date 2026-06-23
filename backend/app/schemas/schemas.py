import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime


def validate_password_strength(v: str) -> str:
    errors = []
    if len(v) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", v):
        errors.append("one uppercase letter (A-Z)")
    if not re.search(r"[a-z]", v):
        errors.append("one lowercase letter (a-z)")
    if not re.search(r"\d", v):
        errors.append("one number (0-9)")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", v):
        errors.append("one special character (!@#$%^&* …)")
    if errors:
        raise ValueError("Password must contain: " + ", ".join(errors))
    return v


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "full_name": "Jane Smith",
                "email": "jane@example.com",
                "password": "securepass123",
                "confirm_password": "securepass123",
            }
        }
    }

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "jane@example.com",
                "password": "securepass123",
            }
        }
    }


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    model_config = {
        "json_schema_extra": {"example": {"email": "jane@example.com"}}
    }


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "token": "abc123...",
                "new_password": "newSecurePass1",
                "confirm_password": "newSecurePass1",
            }
        }
    }

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password_strength(v)


class MessageResponse(BaseModel):
    message: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

    model_config = {
        "json_schema_extra": {
            "example": {"full_name": "Jane Smith", "email": "jane@example.com"}
        }
    }

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip() if v else v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "current_password": "oldPass123",
                "new_password": "newPass456",
                "confirm_password": "newPass456",
            }
        }
    }

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password_strength(v)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "full_name": "Jane Smith",
                "email": "jane@example.com",
                "created_at": "2025-06-22T10:00:00Z",
            }
        },
    }


# ── Job ───────────────────────────────────────────────────────────────────────

class JobBase(BaseModel):
    platform: str
    title: str
    company: str
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    location_region: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    url: str
    posted_at: Optional[datetime] = None


class JobInDB(JobBase):
    id: int
    score: Optional[float] = None
    analysis: Optional[str] = None
    status: str
    fetched_at: datetime
    description_json: Optional[Any] = None

    model_config = {"from_attributes": True}


class JobListItem(BaseModel):
    id: int
    platform: str
    title: str
    company: str
    location: Optional[str] = None
    job_type: Optional[str] = None
    score: Optional[float] = None
    status: str
    posted_at: Optional[datetime] = None
    fetched_at: datetime
    url: str

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 42,
                "platform": "himalayas",
                "title": "Senior Backend Engineer",
                "company": "Acme Corp",
                "location": "Remote",
                "job_type": "remote",
                "score": 87.5,
                "status": "new",
                "posted_at": "2025-06-21T08:00:00Z",
                "fetched_at": "2025-06-22T10:05:00Z",
                "url": "https://himalayas.app/jobs/acme-senior-backend",
            }
        },
    }


class JobDetail(JobInDB):
    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 42,
                "platform": "himalayas",
                "title": "Senior Backend Engineer",
                "company": "Acme Corp",
                "location": "Remote — Anywhere",
                "job_type": "remote",
                "experience_level": "senior",
                "location_region": "Anywhere",
                "tech_stack": ["Python", "FastAPI", "PostgreSQL", "Docker"],
                "url": "https://himalayas.app/jobs/acme-senior-backend",
                "score": 87.5,
                "analysis": '{"summary":"Strong match","strengths":["Python","FastAPI"],"gaps":["Kubernetes"],"suggestions":["Highlight Docker experience"]}',
                "status": "interested",
                "posted_at": "2025-06-21T08:00:00Z",
                "fetched_at": "2025-06-22T10:05:00Z",
                "description_json": {"description": "<p>We are looking for a senior engineer…</p>"},
            }
        },
    }


class JobStatusUpdate(BaseModel):
    status: str

    model_config = {
        "json_schema_extra": {
            "example": {"status": "interested"}
        }
    }


class AnalysisData(BaseModel):
    summary: Optional[str] = None
    strengths: Optional[List[str]] = None
    gaps: Optional[List[str]] = None
    suggestions: Optional[List[str]] = None


class JobScoreUpdate(BaseModel):
    score: float
    analysis: Optional[AnalysisData] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "score": 82.0,
                "analysis": {
                    "summary": "Good match for backend role",
                    "strengths": ["Python", "PostgreSQL"],
                    "gaps": ["Kubernetes"],
                    "suggestions": ["Mention distributed systems experience"],
                },
            }
        }
    }


class PaginatedJobResponse(BaseModel):
    items: List[JobListItem]
    total: int
    page: int
    limit: int
    total_pages: int

    model_config = {
        "json_schema_extra": {
            "example": {
                "items": [],
                "total": 134,
                "page": 1,
                "limit": 20,
                "total_pages": 7,
            }
        }
    }


# ── CV ────────────────────────────────────────────────────────────────────────

class CVVersionResponse(BaseModel):
    id: int
    filename: str
    summary: Optional[str] = None
    uploaded_at: datetime
    is_active: bool

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 3,
                "filename": "jane_smith_cv.pdf",
                "summary": "Senior Software Engineer with 7 years of experience in Python, FastAPI, PostgreSQL…",
                "uploaded_at": "2025-06-20T09:30:00Z",
                "is_active": True,
            }
        },
    }


# ── Filters ───────────────────────────────────────────────────────────────────

class UserFilterRequest(BaseModel):
    role_titles: Optional[List[str]] = None
    experience_level: Optional[List[str]] = None
    location_type: Optional[List[str]] = None
    location_region: Optional[List[str]] = None
    tech_stack: Optional[List[str]] = None
    min_score_threshold: Optional[float] = 0.0
    max_age_hours: Optional[int] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "role_titles": ["Backend Engineer", "Software Engineer", "Python Developer"],
                "experience_level": ["mid", "senior"],
                "location_type": ["remote"],
                "location_region": ["Anywhere", "Asia"],
                "tech_stack": ["Python", "FastAPI", "Docker", "PostgreSQL"],
                "min_score_threshold": 50.0,
                "max_age_hours": 72,
            }
        }
    }


class UserFilterResponse(UserFilterRequest):
    id: int
    updated_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "role_titles": ["Backend Engineer", "Software Engineer"],
                "experience_level": ["senior"],
                "location_type": ["remote"],
                "location_region": ["Anywhere"],
                "tech_stack": ["Python", "FastAPI", "Docker"],
                "min_score_threshold": 50.0,
                "updated_at": "2025-06-22T10:00:00Z",
            }
        },
    }


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "task_id": "b3d2a1c4-1234-5678-abcd-ef0123456789",
                "status": "SUCCESS",
                "message": "{'status': 'success', 'fetched': 312, 'saved': 47, 'users': 2}",
            }
        }
    }
