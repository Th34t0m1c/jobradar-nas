import feedparser
import httpx
from datetime import datetime, timezone
from typing import List
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

REMOTECO_FEED_URL = "https://remote.co/remote-jobs/feed/"


class RemoteCoScraper(BaseScraper):
    PLATFORM_NAME = "remoteco"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)"},
            ) as client:
                response = await client.get(REMOTECO_FEED_URL)
                response.raise_for_status()

            feed = feedparser.parse(response.text)

            for entry in feed.entries:
                try:
                    posted_at = self._parse_date(entry.get("published", ""))
                    if posted_at and not (from_dt <= posted_at <= to_dt):
                        continue

                    raw_title = entry.get("title", "")
                    company = self._extract_company(raw_title, entry)
                    title = self._clean_title(raw_title, company)

                    description_html = entry.get("summary", "") or ""

                    job = NormalizedJob(
                        platform=self.PLATFORM_NAME,
                        title=title,
                        company=company,
                        url=entry.get("link", ""),
                        description=description_html,
                        location="Remote",
                        job_type="remote",
                        experience_level=self.normalize_experience_level(
                            title + " " + BeautifulSoup(description_html, "lxml").get_text()[:300]
                        ),
                        location_region="Anywhere",
                        tech_stack=self._extract_tech_stack(
                            BeautifulSoup(description_html, "lxml").get_text()
                        ),
                        posted_at=posted_at,
                        raw=dict(entry),
                    )
                    jobs.append(job)

                except Exception as e:
                    logger.warning(f"Remote.co: Error parsing entry: {e}")
                    continue

        except Exception as e:
            logger.error(f"Remote.co: Fetch failed: {e}")

        logger.info(f"Remote.co: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, date_str: str) -> datetime:
        try:
            dt = parsedate_to_datetime(date_str)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    def _extract_company(self, title: str, entry) -> str:
        # Remote.co titles are often "Job Title at Company" or "Job Title – Company"
        for sep in (" at ", " @ ", " – ", " - "):
            if sep in title:
                return title.split(sep)[-1].strip()
        author = entry.get("author", "")
        if author:
            return author.strip()
        return "Unknown"

    def _clean_title(self, title: str, company: str) -> str:
        for sep in (" at ", " @ ", " – ", " - "):
            idx = title.find(sep)
            if idx != -1 and title[idx + len(sep):].strip() == company:
                return title[:idx].strip()
        return title.strip()

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
