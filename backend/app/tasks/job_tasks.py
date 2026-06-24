import asyncio
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.tasks.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.models import Job, Platform, User, UserFilter, CVVersion
from app.services.scrapers.weworkremotely import WeWorkRemotelyScraper
from app.services.scrapers.himalayas import HimalayanScraper
from app.services.scrapers.arcdev import ArcDevScraper
from app.services.scrapers.workingnomads import WorkingNomadsScraper
from app.services.scrapers.empllo import EmplloScraper
from app.services.scrapers.remotive import RemotiveScraper
from app.services.scrapers.arbeitnow import ArbeitnowScraper
from app.services.scrapers.jobicy import JobicyScraper
from app.services.scrapers.remoteok import RemoteOKScraper
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
    WorkingNomadsScraper(),
    EmplloScraper(),
    RemotiveScraper(),
    ArbeitnowScraper(),
    JobicyScraper(),
    RemoteOKScraper(),
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
        scoring_task_id = None

        for user in users:
            self.update_state(state="PROGRESS", meta={"step": f"processing user {user.id}"})

            unique_jobs = deduplicate_jobs(all_jobs, db, user.id)

            user_filter = db.query(UserFilter).filter(UserFilter.user_id == user.id).first()
            filtered_jobs = apply_filters(unique_jobs, user_filter)

            saved_count = 0
            new_job_ids = []
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
                    new_job_ids.append(db_job.id)
                    saved_count += 1
                except Exception as e:
                    logger.error(f"Pipeline: Failed to save '{job.title}' for user {user.id}: {e}")
                    db.rollback()

            logger.info(f"Pipeline: user {user.id} — {saved_count} jobs saved")
            total_saved += saved_count

            # Kick off auto-scoring for this user's new jobs
            if new_job_ids:
                scoring_task = auto_score_new_jobs.apply_async(
                    args=[user.id, new_job_ids],
                    headers={"user_id": user.id},
                )
                # For single-user (manual trigger) return the scoring task ID so frontend can track it
                if user_id:
                    scoring_task_id = scoring_task.id
                logger.info(f"Pipeline: queued scoring task {scoring_task.id} for {len(new_job_ids)} jobs (user {user.id})")

        logger.info(f"Pipeline: Complete — {total_saved} total jobs saved across {len(users)} user(s)")
        return {
            "status": "success",
            "fetched": len(all_jobs),
            "saved": total_saved,
            "users": len(users),
            "scoring_task_id": scoring_task_id,
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


@celery_app.task(bind=True, name="app.tasks.job_tasks.auto_score_new_jobs")
def auto_score_new_jobs(self, user_id: int, job_ids: list):
    """Score newly saved jobs against the user's active CV summary."""
    if not job_ids:
        return {"status": "success", "scored": 0, "total": 0}

    from app.services.match_service import match_cv_to_job

    db = SessionLocal()
    try:
        cv = db.query(CVVersion).filter(
            CVVersion.user_id == user_id,
            CVVersion.is_active == True,
        ).first()

        if not cv or not cv.summary:
            logger.info(f"AutoScore: No CV summary for user {user_id} — skipping")
            return {"status": "skipped", "reason": "no_cv_summary", "scored": 0, "total": len(job_ids)}

        scored = 0
        for i, job_id in enumerate(job_ids):
            self.update_state(state="PROGRESS", meta={"step": f"scoring {i + 1}/{len(job_ids)}", "user_id": user_id})
            job = db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()
            if not job:
                continue
            try:
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
                scored += 1
            except Exception as e:
                logger.error(f"AutoScore: Failed to score job {job_id}: {e}")
                db.rollback()

        logger.info(f"AutoScore: Scored {scored}/{len(job_ids)} jobs for user {user_id}")
        return {"status": "success", "scored": scored, "total": len(job_ids)}
    finally:
        db.close()
