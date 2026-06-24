import os
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import get_settings
from app.models.models import CVVersion, Job, User
from app.schemas.schemas import CVVersionResponse, CVSummaryUpdate, CVSuggestionsResponse
from app.services.suggestion_service import extract_suggestions
from app.services.cv_service import (
    extract_text_from_pdf,
    save_cv_version,
    get_all_cv_versions,
)

settings = get_settings()
router = APIRouter(prefix="/cv", tags=["cv"])

MAX_CV_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _safe_filename(filename: str) -> str:
    name = os.path.basename(filename)
    name = re.sub(r"[^\w.\- ]", "_", name)
    return name or "cv.pdf"


@router.post(
    "/upload",
    response_model=CVVersionResponse,
    summary="Upload CV",
    description=(
        "Upload a PDF CV (max 10 MB). "
        "Text is extracted and stored. The CV is set as active immediately. "
        "Use PATCH /cv/{id}/summary to save the AI-generated summary before job matching is enabled."
    ),
)
async def upload_cv(
    file: UploadFile = File(..., description="PDF file, max 10 MB"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()

    if len(content) > MAX_CV_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large — maximum size is 10 MB")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    user_dir = os.path.join(settings.CV_UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    safe_name = _safe_filename(file.filename)
    file_path = os.path.join(user_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        extracted_text = extract_text_from_pdf(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {str(e)}")

    cv = save_cv_version(
        db,
        filename=safe_name,
        file_path=file_path,
        extracted_text=extracted_text,
        user_id=current_user.id,
    )
    return cv


@router.get(
    "/suggestions",
    response_model=CVSuggestionsResponse,
    summary="CV-based filter suggestions",
    description=(
        "Extract suggested role titles and tech/tool keywords from the active CV summary. "
        "Returns empty lists if the user has no active CV or the summary has not been saved yet."
    ),
)
def get_cv_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cv = db.query(CVVersion).filter(
        CVVersion.is_active == True,
        CVVersion.user_id == current_user.id,
    ).first()
    if not cv or not cv.summary:
        return CVSuggestionsResponse(role_titles=[], tech_stack=[])
    return extract_suggestions(cv.summary)


@router.patch(
    "/{cv_id}/summary",
    response_model=CVVersionResponse,
    summary="Save AI summary",
    description=(
        "Save the user-provided AI summary for a CV version. "
        "Once saved, the summary is used for all job matching. "
        "Job matching is disabled until a summary is saved."
    ),
)
def set_cv_summary(
    cv_id: int,
    body: CVSummaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cv = db.query(CVVersion).filter(
        CVVersion.id == cv_id, CVVersion.user_id == current_user.id
    ).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV version not found")
    cv.summary = body.summary
    db.commit()
    db.refresh(cv)
    return cv


@router.get(
    "",
    response_model=List[CVVersionResponse],
    summary="List CV versions",
    description="Return all CV versions uploaded by the authenticated user, newest first.",
)
def list_cv_versions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_all_cv_versions(db, user_id=current_user.id)


@router.get(
    "/active",
    response_model=CVVersionResponse,
    summary="Get active CV",
    description="Return the currently active CV version for the authenticated user.",
)
def get_active_cv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cv = db.query(CVVersion).filter(
        CVVersion.is_active == True, CVVersion.user_id == current_user.id
    ).first()
    if not cv:
        raise HTTPException(status_code=404, detail="No active CV found")
    return cv


@router.delete(
    "/{cv_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a CV version",
    description="Permanently delete a CV version and its file from disk. The active CV cannot be deleted — activate another version first.",
)
def delete_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cv = db.query(CVVersion).filter(CVVersion.id == cv_id, CVVersion.user_id == current_user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV version not found")
    if cv.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the active CV — activate another version first",
        )
    db.query(Job).filter(Job.cv_version_id == cv_id).update({"cv_version_id": None})
    try:
        if cv.file_path and os.path.exists(cv.file_path):
            os.remove(cv.file_path)
    except OSError:
        pass
    db.delete(cv)
    db.commit()


@router.post(
    "/{cv_id}/activate",
    response_model=CVVersionResponse,
    summary="Activate a CV version",
    description="Set a specific CV version as active. All other versions for this user are deactivated.",
)
def activate_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cv = db.query(CVVersion).filter(CVVersion.id == cv_id, CVVersion.user_id == current_user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV version not found")

    db.query(CVVersion).filter(CVVersion.user_id == current_user.id).update({"is_active": False})
    cv.is_active = True
    db.commit()
    db.refresh(cv)
    return cv
