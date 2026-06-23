from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import UserFilter, User
from app.schemas.schemas import UserFilterRequest, UserFilterResponse

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get(
    "",
    response_model=UserFilterResponse,
    summary="Get filters",
    description="Return the current job pre-filter preferences for the authenticated user.",
)
def get_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(UserFilter).filter(UserFilter.user_id == current_user.id).first()
    if not f:
        raise HTTPException(status_code=404, detail="No filters configured yet")
    return f


@router.put(
    "",
    response_model=UserFilterResponse,
    summary="Save filters",
    description=(
        "Create or update job pre-filter preferences. "
        "These are applied at pipeline time — jobs that don't match are discarded before storage. "
        "Set `min_score_threshold` to hide low-scoring jobs in the dashboard."
    ),
)
def save_filters(
    body: UserFilterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(UserFilter).filter(UserFilter.user_id == current_user.id).first()

    if f:
        f.role_titles = body.role_titles
        f.experience_level = body.experience_level
        f.location_type = body.location_type
        f.location_region = body.location_region
        f.tech_stack = body.tech_stack
        f.min_score_threshold = body.min_score_threshold or 0.0
        f.max_age_hours = body.max_age_hours
    else:
        f = UserFilter(
            user_id=current_user.id,
            role_titles=body.role_titles,
            experience_level=body.experience_level,
            location_type=body.location_type,
            location_region=body.location_region,
            tech_stack=body.tech_stack,
            min_score_threshold=body.min_score_threshold or 0.0,
            max_age_hours=body.max_age_hours,
        )
        db.add(f)

    db.commit()
    db.refresh(f)
    return f
