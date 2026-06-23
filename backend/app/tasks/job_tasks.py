import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.tasks.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.models import Job, Platform, User, UserFilter
from app.services.scrapers.weworkremotely import WeWorkRemotelyScraper
from app.services.scrapers.himalayas import HimalayanScraper
from app.services.scrapers.arcdev import ArcDevScraper
from app.services.scrapers.remoteok import RemoteOKScraper
from app.services.scrapers.workingnomads import WorkingNomadsScraper
from app.services.scrapers.empllo import EmplloScraper
from app.services.scrapers.remotive import RemotiveScraper
from app.services.scrapers.arbeitnow import ArbeitnowScraper
from app.services.scrapers.jobicy import JobicyScraper
from app.services.scrapers.remoteco import RemoteCoScraper
from app.services.deduplicator import deduplicate_jobs
from app.services.filter_service import apply_filters
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

SCRAPERS = [
    WeWorkRemotelyScraper(),
    HimalayanScraper(),
    ArcDevScraper(),
    RemoteOKScraper(),
    WorkingNomadsScraper(),
    EmplloScraper(),
    RemotiveScraper(),
    ArbeitnowScraper(),
    JobicyScraper(),
    RemoteCoScraper(),
]


@celery_app.task(bind=True, name="app.tasks.job_tasks.run_daily_job_pipeline")
def run_daily_job_pipeline(self, user_id: int = None):
    """
    Fetch jobs and store them per user.
    If user_id is given, runs only for that user (manual trigger).
    If user_id is None, runs for all active users (scheduled Beat run).
    """
    logger.info(f"Pipeline: Starting (user_id={user_id or 'all'})")
    self.update_state(state="STARTED", meta={"step": "initializing"})
    db = SessionLocal()
    try:
        cleanup_old_jobs(db)

        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(hours=settings.JOB_FETCH_WINDOW_HOURS)
        logger.info(f"Pipeline: Fetch window {from_dt} -> {now}")

        self.update_state(state="PROGRESS", meta={"step": "fetching"})
        all_jobs = asyncio.run(fetch_all_platforms(db, from_dt, now))

        # Determine which users to process
        if user_id:
            users = db.query(User).filter(User.id == user_id, User.is_active == True).all()
        else:
            users = db.query(User).filter(User.is_active == True).all()

        if not users:
            logger.warning("Pipeline: No active users found — nothing to save")
            return {"status": "success", "fetched": len(all_jobs), "saved": 0}

        total_saved = 0
        for user in users:
            self.update_state(state="PROGRESS", meta={"step": f"processing user {user.id}"})

            unique_jobs = deduplicate_jobs(all_jobs, db, user.id)

            user_filter = db.query(UserFilter).filter(UserFilter.user_id == user.id).first()
            filtered_jobs = apply_filters(unique_jobs, user_filter)

            saved_count = 0
            for job, fingerprint in filtered_jobs:
                try:
                    db_job = Job(
                        user_id=user.id,
                        platform=job.platform, title=job.title, company=job.company,
                        location=(job.location or "")[:1000], job_type=job.job_type,
                        experience_level=job.experience_level,
                        location_region=(job.location_region or "")[:500],
                        tech_stack=job.tech_stack, description_json=job.raw,
                        url=job.url, fingerprint=fingerprint,
                        status="new", posted_at=job.posted_at,
                    )
                    db.add(db_job)
                    db.commit()
                    saved_count += 1
                except Exception as e:
                    logger.error(f"Pipeline: Failed to save '{job.title}' for user {user.id}: {e}")
                    db.rollback()  # reset session so next insert gets a clean transaction

            logger.info(f"Pipeline: user {user.id} — {saved_count} jobs saved")
            total_saved += saved_count

        logger.info(f"Pipeline: Complete — {total_saved} total jobs saved across {len(users)} user(s)")
        return {
            "status": "success",
            "fetched": len(all_jobs),
            "saved": total_saved,
            "users": len(users),
        }
    except Exception as e:
        logger.error(f"Pipeline: Fatal error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def fetch_all_platforms(db: Session, from_dt: datetime, to_dt: datetime):
    active_platforms = {p.name for p in db.query(Platform).filter(Platform.is_active == True).all()}
    tasks = [s.fetch(from_dt, to_dt) for s in SCRAPERS if s.PLATFORM_NAME in active_platforms]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_jobs = []
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Pipeline: Scraper failed: {result}")
        else:
            all_jobs.extend(result)
    return all_jobs


def cleanup_old_jobs(db: Session):
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.JOB_RETENTION_DAYS)
    deleted = db.query(Job).filter(Job.fetched_at < cutoff).delete(synchronize_session=False)
    db.commit()
    logger.info(f"Cleanup: Deleted {deleted} jobs older than {settings.JOB_RETENTION_DAYS} days")
