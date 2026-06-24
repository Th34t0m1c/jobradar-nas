from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import Platform, User

router = APIRouter(prefix="/platforms", tags=["platforms"])


@router.get(
    "",
    summary="List platforms",
    description="Return all job platforms and their active status.",
)
def list_platforms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platforms = db.query(Platform).order_by(Platform.id).all()
    return [{"key": p.name, "is_active": p.is_active} for p in platforms]
