from app.db.database import engine, Base
from app.models.models import User, Job, CVVersion, UserFilter, Platform, PasswordResetToken
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


def init_db():
    """Create all tables and seed default data."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database: Tables created")

    db = Session(engine)
    try:
        _seed_platforms(db)
    finally:
        db.close()


def _seed_platforms(db: Session):
    """Insert default platforms if they don't exist."""
    platforms = {
        "weworkremotely": True,
        "himalayas": True,
        "arcdev": True,
        "workingnomads": True,
        "empllo": True,
        "remotive": True,
        "arbeitnow": True,
        "jobicy": True,
        "remoteok": True,
    }
    for name, is_active in platforms.items():
        exists = db.query(Platform).filter(Platform.name == name).first()
        if not exists:
            db.add(Platform(name=name, is_active=is_active))
    db.commit()
    logger.info("Database: Platforms seeded")


if __name__ == "__main__":
    init_db()
