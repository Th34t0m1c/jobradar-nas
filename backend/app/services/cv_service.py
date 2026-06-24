import os
import pdfplumber
from sqlalchemy.orm import Session
from app.models.models import CVVersion
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.error(f"CV: PDF extraction failed: {e}")
        raise
    return text.strip()


def save_cv_version(
    db: Session,
    filename: str,
    file_path: str,
    extracted_text: str,
    user_id: int,
) -> CVVersion:
    db.query(CVVersion).filter(CVVersion.user_id == user_id).update({"is_active": False})
    db.commit()

    cv = CVVersion(
        user_id=user_id,
        filename=filename,
        file_path=file_path,
        extracted_text=extracted_text,
        summary=None,
        is_active=True,
    )
    db.add(cv)
    db.commit()
    db.refresh(cv)
    logger.info(f"CV: Saved new version '{filename}' as active for user {user_id} (id={cv.id})")
    return cv


def get_all_cv_versions(db: Session, user_id: int):
    return db.query(CVVersion).filter(CVVersion.user_id == user_id).order_by(CVVersion.uploaded_at.desc()).all()
