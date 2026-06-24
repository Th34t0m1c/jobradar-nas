import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

JOBICY_API_URL = "https://jobicy.com/api/v2/remote-jobs"


class JobicyScraper(BaseScraper):
    PLATFORM_NAME = "jobicy"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)"},
            ) as client:
                response = await client.get(JOBICY_API_URL, params={"count": 50})
                response.raise_for_status()
                data = response.json()

            for entry in data.get("jobs", []):
                try:
                    posted_at = self._parse_date(entry.get("pubDate"))
                    if posted_at and not (from_dt <= posted_at <= to_dt):
                        continue

                    description = entry.get("jobDescription") or entry.get("jobExcerpt") or ""

                    job = NormalizedJob(
                        platform=self.PLATFORM_NAME,
                        title=entry.get("jobTitle", ""),
                        company=entry.get("companyName", "Unknown"),
                        url=entry.get("url", ""),
                        description=description,
                        location=entry.get("jobGeo") or "Anywhere",
                        job_type=self._map_job_type(entry.get("jobType", "")),
                        experience_level=self.normalize_experience_level(
                            entry.get("jobTitle", "") + " " + description[:500]
                        ),
                        location_region=self._map_region(entry.get("jobGeo", "")),
                        tech_stack=self.extract_tech_stack(description),
                        salary=self._extract_salary(entry),
                        posted_at=posted_at,
                        raw={**entry, "description": description},
                    )
                    jobs.append(job)

                except Exception as e:
                    logger.warning(f"Jobicy: Error parsing entry: {e}")
                    continue

        except Exception as e:
            logger.error(f"Jobicy: Fetch failed: {e}")

        logger.info(f"Jobicy: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, value: str) -> datetime:
        if not value:
            return None
        try:
            # API now returns ISO 8601: "2026-06-24T14:26:42+00:00"
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            try:
                # Legacy format: "2024-01-15 10:30:00" (UTC)
                return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            except Exception:
                return None

    def _map_job_type(self, raw) -> str:
        if isinstance(raw, list):
            raw = raw[0] if raw else ""
        return self.normalize_job_type(str(raw).lower()) or "remote"

    def _map_region(self, geo: str) -> str:
        g = geo.lower()
        if not g or any(k in g for k in ("anywhere", "worldwide", "global")):
            return "Anywhere"
        if any(k in g for k in ("usa", "us only", "united states", "north america")):
            return "USA"
        if any(k in g for k in ("europe", " eu", "uk", "emea")):
            return "Europe"
        if any(k in g for k in ("asia", "apac")):
            return "Asia"
        if any(k in g for k in ("latin america", "latam")):
            return "Latin America"
        return "Anywhere"

    def _extract_salary(self, entry: dict) -> str:
        lo = entry.get("annualSalaryMin")
        hi = entry.get("annualSalaryMax")
        currency = entry.get("salaryCurrency") or "USD"
        try:
            if lo and hi and float(lo) > 0 and float(hi) > 0:
                return f"{currency} {int(float(lo)):,} – {int(float(hi)):,}"
            if lo and float(lo) > 0:
                return f"{currency} {int(float(lo)):,}+"
        except (TypeError, ValueError):
            pass
        return None

