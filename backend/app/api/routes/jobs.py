from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional
from math import ceil
import json

from datetime import datetime, timezone, timedelta
from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import get_settings
from app.models.models import Job, CVVersion, User, UserFilter
from app.schemas.schemas import (
    JobListItem, JobDetail, JobStatusUpdate, JobScoreUpdate,
    PaginatedJobResponse, TaskStatusResponse
)

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/jobs", tags=["jobs"])

VALID_STATUSES = {"new", "interested", "applied", "skipped"}
VALID_SORT_FIELDS = {"score", "posted_at", "fetched_at", "platform", "title", "status"}
VALID_ORDERS = {"asc", "desc"}


@router.get(
    "",
    response_model=PaginatedJobResponse,
    summary="List jobs",
    description=(
        "Paginated list of jobs for the authenticated user. "
        "Supports filtering by platform, status, score range, and title keyword. "
        "Sortable by score, posted_at, fetched_at, platform, title, or status."
    ),
)
def list_jobs(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Results per page (max 100)"),
    sort_by: str = Query(default="fetched_at", description="Field to sort by"),
    order: str = Query(default="desc", description="Sort direction: asc or desc"),
    platform: Optional[str] = Query(default=None, description="Filter by platform key e.g. himalayas"),
    status: Optional[str] = Query(default=None, description="Filter by status: new / interested / applied / skipped"),
    experience_level: Optional[str] = Query(default=None, description="Filter by experience level: junior / mid / senior"),
    score_min: Optional[float] = Query(default=None, description="Minimum score (0–100)"),
    score_max: Optional[float] = Query(default=None, description="Maximum score (0–100)"),
    title: Optional[str] = Query(default=None, description="Case-insensitive title keyword search"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if sort_by not in VALID_SORT_FIELDS:
        sort_by = "fetched_at"
    if order not in VALID_ORDERS:
        order = "desc"

    query = db.query(Job).filter(Job.user_id == current_user.id)

    # Apply saved max_age_hours preference
    user_filter = db.query(UserFilter).filter(UserFilter.user_id == current_user.id).first()
    if user_filter and user_filter.max_age_hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=user_filter.max_age_hours)
        query = query.filter(Job.posted_at >= cutoff)

    if platform:
        query = query.filter(Job.platform == platform)
    if status:
        query = query.filter(Job.status == status)
    if experience_level:
        query = query.filter(Job.experience_level == experience_level)
    if score_min is not None:
        query = query.filter(Job.score >= score_min)
    if score_max is not None:
        query = query.filter(Job.score <= score_max)
    if title:
        query = query.filter(Job.title.ilike(f"%{title}%"))

    total = query.count()

    sort_col = getattr(Job, sort_by, Job.fetched_at)
    query = query.order_by(desc(sort_col) if order == "desc" else asc(sort_col))

    offset = (page - 1) * limit
    jobs = query.offset(offset).limit(limit).all()

    return PaginatedJobResponse(
        items=jobs,
        total=total,
        page=page,
        limit=limit,
        total_pages=ceil(total / limit) if total > 0 else 1,
    )


@router.get(
    "/{job_id}",
    response_model=JobDetail,
    summary="Get job detail",
    description="Full detail for a single job including raw description JSON and analysis.",
)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch(
    "/{job_id}/score",
    summary="Save score manually",
    description="Manually save a score and analysis for a job. Use this to override or set a score without running the CV matcher.",
)
def save_job_score(
    job_id: int,
    body: JobScoreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.score = max(0.0, min(100.0, body.score))
    job.analysis = json.dumps(body.analysis.model_dump()) if body.analysis else None
    db.commit()
    return {"message": "Score saved"}


@router.patch(
    "/{job_id}/status",
    summary="Update job status",
    description="Set the tracking status for a job. Valid values: `new`, `interested`, `applied`, `skipped`.",
)
def update_job_status(
    job_id: int,
    body: JobStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {VALID_STATUSES}",
        )
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = body.status
    db.commit()
    return {"message": f"Status updated to '{body.status}'"}


@router.delete(
    "",
    summary="Delete all jobs",
    description="Permanently delete every job belonging to the authenticated user. CV, filters, and user account are not affected.",
)
def delete_all_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.query(Job).filter(Job.user_id == current_user.id).delete()
    db.commit()
    return {"message": f"Deleted {count} jobs"}


@router.delete(
    "/{job_id}",
    summary="Delete a job",
    description="Permanently delete a single job by ID.",
)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}


@router.post(
    "/{job_id}/match",
    summary="Match job against CV",
    description=(
        "Score a job against the user's active CV using keyword + tech-stack matching. "
        "Returns a 0–100 score with summary, strengths, gaps, and suggestions. "
        "Saves the result to the job record."
    ),
)
def match_job_with_cv(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    cv = db.query(CVVersion).filter(
        CVVersion.is_active == True, CVVersion.user_id == current_user.id
    ).first()
    if not cv or not cv.summary:
        raise HTTPException(status_code=400, detail="No active CV found. Upload a CV first.")

    from app.services.match_service import match_cv_to_job
    result = match_cv_to_job(cv.summary, job)

    job.score = result["score"]
    job.analysis = json.dumps({
        "summary": result["summary"],
        "strengths": result["strengths"],
        "gaps": result["gaps"],
        "suggestions": result["suggestions"],
    })
    job.cv_version_id = cv.id
    db.commit()

    return result


@router.post(
    "/trigger",
    response_model=TaskStatusResponse,
    summary="Trigger job pipeline",
    description=(
        "Manually trigger the daily job pipeline for the authenticated user. "
        "Fetches from all active platforms, deduplicates, applies filters, and saves new jobs. "
        "Returns a Celery task ID — poll `GET /api/jobs/task/{task_id}` for status."
    ),
)
@limiter.limit(lambda: get_settings().TRIGGER_RATE_LIMIT)
def trigger_pipeline(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    from app.tasks.job_tasks import run_daily_job_pipeline
    task = run_daily_job_pipeline.apply_async(
        kwargs={"user_id": current_user.id},
        headers={"user_id": current_user.id},
    )
    return TaskStatusResponse(
        task_id=task.id,
        status="queued",
        message="Daily pipeline triggered manually",
    )


@router.get(
    "/task/{task_id}",
    response_model=TaskStatusResponse,
    summary="Check task status",
    description="Poll the status of a background Celery task. Status values: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE.",
)
def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    from app.tasks.celery_app import celery_app
    result = celery_app.AsyncResult(task_id)

    # Verify this task belongs to the requesting user
    task_user_id = (result.info or {}).get("user_id") if isinstance(result.info, dict) else None
    if result.status not in ("PENDING",) and task_user_id and task_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")

    result_payload = result.result if result.ready() else None
    return TaskStatusResponse(
        task_id=task_id,
        status=result.status,
        message=str(result_payload) if result_payload and not isinstance(result_payload, dict) else None,
        result=result_payload if isinstance(result_payload, dict) else None,
    )
