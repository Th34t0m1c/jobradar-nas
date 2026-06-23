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
                        tech_stack=self._extract_tech_stack(description),
                        salary=self._extract_salary(entry),
                        posted_at=posted_at,
                        raw=entry,
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
            # API returns "2024-01-15 10:30:00" (UTC)
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            try:
                dt = datetime.fromisoformat(str(value))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                return None

    def _map_job_type(self, raw: str) -> str:
        return self.normalize_job_type(raw.lower()) or "remote"

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

    def _extract_tech_stack(self, text: str) -> List[str]:
        known_tech = [
            "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "Kotlin",
            "Ruby", "PHP", "C++", "C#", "Swift", "React", "Vue", "Angular",
            "Node.js", "FastAPI", "Django", "Flask", "Laravel", "Rails",
            "Docker", "Kubernetes", "AWS", "Azure", "GCP", "PostgreSQL",
            "MySQL", "MongoDB", "Redis", "GraphQL", "REST", "gRPC",
        ]
        text_lower = text.lower()
        return [t for t in known_tech if t.lower() in text_lower][:10]
